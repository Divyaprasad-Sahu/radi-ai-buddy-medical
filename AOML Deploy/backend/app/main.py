import asyncio
from collections import OrderedDict, deque
from contextlib import asynccontextmanager
import logging
import os
from pathlib import Path
import time
from typing import Literal
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from starlette.concurrency import run_in_threadpool
from starlette.responses import JSONResponse

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
from .chatbot import generate_response, ai_chat, ChatUnavailable
from .model import get_model, model_metadata, ModelUnavailable
from .predict import MAX_UPLOAD_BYTES, predict_from_image_bytes, validate_upload

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app):
    try:
        await run_in_threadpool(get_model)
    except ModelUnavailable:
        logger.warning("Screening disabled: validated ONNX artifact unavailable")
    yield

app = FastAPI(title="Multilingual X-ray Screening Demo", lifespan=lifespan)
origins = os.getenv("CORS_ORIGINS", "http://localhost:8080,http://127.0.0.1:8080,http://127.0.0.1:8081").split(",")
app.add_middleware(CORSMiddleware, allow_origins=[o.strip() for o in origins if o.strip()],
    allow_credentials=False, allow_methods=["GET", "POST"], allow_headers=["Content-Type"])
_requests = OrderedDict()
_capacity = asyncio.Semaphore(1)

@app.middleware("http")
async def protect(request: Request, call_next):
    if request.method == "POST":
        now = time.monotonic()
        key = request.client.host if request.client else "unknown"
        bucket = _requests.setdefault(key, deque())
        _requests.move_to_end(key)
        while bucket and bucket[0] < now - 60:
            bucket.popleft()
        if len(bucket) >= 10:
            return JSONResponse({"detail": "rate_limited"}, status_code=429, headers={"Retry-After": "60"})
        bucket.append(now)
        while len(_requests) > 4096:
            _requests.popitem(last=False)
        limit = MAX_UPLOAD_BYTES + 65536 if request.url.path == "/predict" else 100_000
        try:
            if int(request.headers.get("content-length", "0")) > limit:
                return JSONResponse({"detail": "too_large"}, status_code=413)
        except ValueError:
            return JSONResponse({"detail": "invalid_request"}, status_code=400)
        chunks = []
        received = 0
        async for chunk in request.stream():
            received += len(chunk)
            if received > limit:
                return JSONResponse({"detail": "too_large"}, status_code=413)
            chunks.append(chunk)
        request._body = b"".join(chunks)
    try:
        response = await call_next(request)
    except HTTPException as exc:
        response = JSONResponse({"detail": exc.detail}, status_code=exc.status_code)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response

class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)

class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    disease: Literal["Normal", "No Finding", "Pneumonia", "Uncertain"] | None = None
    confidence: float | None = Field(default=None, ge=0, le=1, allow_inf_nan=False)
    model_version: str | None = Field(default=None,max_length=100)
    calibrated: bool | None = None
    symptoms: str | None = Field(default=None, max_length=2000)
    language: Literal["en", "hi", "mr"] = "en"
    question: str = Field(min_length=1, max_length=2000, pattern=r"\S")
    history: list[ChatMessage] = Field(default_factory=list, max_length=20)

@app.get("/health")
async def health():
    try:
        metadata = await run_in_threadpool(model_metadata)
        return {"status": "ok", "model_ready": True, "model_version": metadata["version"]}
    except ModelUnavailable:
        return JSONResponse({"status": "degraded", "model_ready": False}, status_code=503)

async def with_capacity(function, *args, **kwargs):
    try:
        await asyncio.wait_for(_capacity.acquire(), timeout=2)
    except TimeoutError as exc:
        raise HTTPException(429, "busy") from exc
    try:
        return await run_in_threadpool(function, *args, **kwargs)
    finally:
        _capacity.release()

@app.post("/predict")
async def predict(file: UploadFile = File(...), symptoms: str = Form(default="", max_length=2000),
                  language: Literal["en", "hi", "mr"] = Form(default="en")):
    try:
        validate_upload(file.content_type)
        image_bytes = await file.read(MAX_UPLOAD_BYTES + 1)
        if len(image_bytes) > MAX_UPLOAD_BYTES:
            raise HTTPException(413, "too_large")
        disease, confidence = await with_capacity(predict_from_image_bytes, image_bytes)
        metadata = model_metadata()
        return {"disease": disease, "confidence": round(confidence, 4),
            "chat_response": generate_response(disease, confidence, symptoms, language),
            "model_version": metadata["version"], "calibrated": bool(metadata.get("calibrated"))}
    except ModelUnavailable as exc:
        raise HTTPException(503, "model_unavailable") from exc
    except ValueError as exc:
        raise HTTPException(400, "invalid_image") from exc
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Inference failed: %s", type(exc).__name__)
        raise HTTPException(500, "server_error") from exc
    finally:
        await file.close()

@app.post("/chat")
async def chat(request: ChatRequest):
    try:
        response = await with_capacity(ai_chat, request.question, request.language,
            [m.model_dump() for m in request.history],request.disease,request.confidence,request.symptoms,
            {"version":request.model_version,"calibrated":request.calibrated})
        return {"chat_response": response}
    except ChatUnavailable as exc:
        raise HTTPException(429 if exc.code == "rate_limited" else 504 if exc.code == "timeout" else 503, exc.code) from exc

@app.get("/chat/status")
async def chat_status():
    return {"configured":bool(os.getenv("GROQ_API_KEY")),"provider":"Groq"}

@app.post("/explain")
async def explain(request: ChatRequest):
    # Local formatting of an image result is not an alternative chatbot.
    if request.disease is None or request.confidence is None:
        raise HTTPException(422,"invalid_request")
    return {"chat_response":generate_response(request.disease,request.confidence,request.symptoms,request.language)}

@app.get("/insights")
async def insights():
    import json
    root = Path(__file__).resolve().parent.parent
    data = {}
    for key, path in [("dataset",root/"data/processed/cleaning.json"),("evaluation",root/"artifacts/evaluation.json")]:
        try:
            source=json.loads(path.read_text(encoding="utf-8"))
            allowed = ["images_found","clean_rows","clean_patients","scope","split_counts"] if key=="dataset" else ["baseline_validation","candidate_validation","selected_test","selected","temperature"]
            data[key]={field:source[field] for field in allowed if field in source}
        except (OSError, ValueError):
            data[key]=None
    try:
        metadata=model_metadata()
        data["model"]={"ready":True,"version":metadata["version"],"calibrated":bool(metadata.get("calibrated"))}
    except ModelUnavailable:
        data["model"]={"ready":False}
    return data

