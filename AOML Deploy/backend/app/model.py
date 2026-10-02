"""ONNX-only serving; legacy checkpoints are evaluated offline."""
import hashlib
import json
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = Path(os.getenv("MODEL_PATH", str(BASE_DIR / "models/pneumonia_model.onnx")))
_MODEL = None
_METADATA = None

class ModelUnavailable(RuntimeError):
    pass

def get_model():
    global _MODEL, _METADATA
    if _MODEL is not None:
        return _MODEL
    if not MODEL_PATH.is_file() or not MODEL_PATH.with_suffix(".json").is_file():
        raise ModelUnavailable("Validated model artifact unavailable")
    try:
        metadata = json.loads(MODEL_PATH.with_suffix(".json").read_text(encoding="utf-8"))
        if metadata.get("validated") is not True or metadata.get("classes") != ["No Finding", "Pneumonia"]:
            raise ValueError("Unvalidated model or incompatible classes")
        if hashlib.sha256(MODEL_PATH.read_bytes()).hexdigest() != metadata.get("sha256"):
            raise ValueError("Checksum mismatch")
        if not 0.05 <= float(metadata["temperature"]) <= 20 or not metadata.get("version"):
            raise ValueError("Invalid metadata")
        import onnxruntime as ort
        options = ort.SessionOptions()
        options.intra_op_num_threads = 1
        options.inter_op_num_threads = 1
        session = ort.InferenceSession(str(MODEL_PATH), options, providers=["CPUExecutionProvider"])
        _MODEL, _METADATA = session, metadata
        return session
    except Exception as exc:
        raise ModelUnavailable("Model validation failed") from exc

def model_metadata():
    get_model()
    return dict(_METADATA)

