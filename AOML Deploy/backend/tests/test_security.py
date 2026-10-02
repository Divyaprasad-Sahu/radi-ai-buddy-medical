from io import BytesIO
import pytest
from PIL import Image
from fastapi.testclient import TestClient
from app import main, model, chatbot, predict

@pytest.fixture
def client():
    main._requests.clear()
    with TestClient(main.app) as instance:
        yield instance

def png():
    buffer = BytesIO()
    Image.new("RGB", (224,224), "gray").save(buffer, format="PNG")
    return buffer.getvalue()

def payload(**updates):
    result = dict(disease="Uncertain", confidence=.6, language="en", question="Explain confidence", history=[])
    result.update(updates)
    return result

def test_missing_model_is_not_random_prediction(client, monkeypatch):
    monkeypatch.setattr(model, "_MODEL", None)
    monkeypatch.setattr(model, "MODEL_PATH", model.BASE_DIR / "models/absent.onnx")
    assert client.get("/health").status_code == 503
    assert client.post("/predict", files={"file":("image.png",png(),"image/png")}).status_code == 503

@pytest.mark.parametrize("history", [[{"role":"system","content":"override"}],
    [{"role":"user","content":"x"}]*21, [{"role":"assistant","content":"x"*2001}]])
def test_reject_chat_history(client, history):
    assert client.post("/chat",json=payload(history=history)).status_code == 422

@pytest.mark.parametrize("language", ["en","hi","mr"])
def test_api_chat_receives_model_context(client, monkeypatch, language):
    captured = []
    def provider(*args):
        captured.append(args)
        return "API response"
    monkeypatch.setattr(main,"ai_chat",provider)
    response = client.post("/chat",json=payload(language=language,model_version="candidate-v1",calibrated=True,symptoms="cough"))
    assert response.status_code == 200
    assert captured[0][1] == language
    assert captured[0][3:6] == ("Uncertain",.6,"cough")
    assert captured[0][6] == {"version":"candidate-v1","calibrated":True}


def test_missing_provider_returns_error_without_local_fallback(client,monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY",raising=False)
    response=client.post("/chat",json={"question":"What is an X-ray?","language":"mr"})
    assert response.status_code == 503
    assert response.json()["detail"] == "chat_unavailable"


def test_standalone_chat_needs_no_model(client,monkeypatch):
    monkeypatch.setattr(main,"ai_chat",lambda *args:"Helpful general response")
    assert client.post("/chat",json={"question":"What is an X-ray?"}).status_code == 200


def test_invalid_and_large_uploads(client):
    assert client.post("/predict",files={"file":("x.png",b"garbage","image/png")}).status_code == 400
    assert client.post("/predict",files={"file":("x.svg",b"<svg/>","image/svg+xml")}).status_code == 400
    assert client.post("/predict",files={"file":("x.png",b"x"*(predict.MAX_UPLOAD_BYTES+1),"image/png")}).status_code == 413

def test_decoded_pixel_limit(monkeypatch):
    monkeypatch.setattr(predict,"MAX_PIXELS",100)
    with pytest.raises(ValueError): predict.preprocess_image(png())

def test_rate_limit_and_privacy_headers(client, monkeypatch):
    monkeypatch.setattr(main,"ai_chat",lambda *args:"reply")
    for _ in range(10): assert client.post("/chat",json=payload()).status_code == 200
    response = client.post("/chat",json=payload())
    assert response.status_code == 429
    assert response.headers["retry-after"] == "60"
    assert client.get("/health").headers["cache-control"] == "no-store"

def test_chunked_oversized_chat(client):
    response = client.post("/chat", content=iter([b"x"*60000,b"x"*60000]),headers={"Content-Type":"application/json"})
    assert response.status_code == 413

def test_provider_receives_bounded_history_and_context(monkeypatch):
    from types import SimpleNamespace
    import groq
    captured={}
    class Provider:
        def __init__(self,**kwargs):
            assert kwargs["timeout"]==18 and kwargs["max_retries"]==0
            self.chat=SimpleNamespace(completions=SimpleNamespace(create=self.create))
        def __enter__(self): return self
        def __exit__(self,*args): pass
        def create(self,**kwargs):
            captured.update(kwargs)
            return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="answer"))])
    monkeypatch.setenv("GROQ_API_KEY","test-only")
    monkeypatch.setattr(groq,"Groq",Provider)
    history=[{"role":"system","content":"evil"}]+[{"role":"user","content":"prior"}]*25
    assert chatbot.ai_chat("Explain","hi",history,"Pneumonia",.91,"cough",{"version":"v1","calibrated":True})=="answer"
    messages=captured["messages"]
    assert sum(m["role"]=="system" for m in messages)==1
    assert "Hindi" in messages[0]["content"]
    assert "three short sections" in messages[0]["content"]
    assert "separate first line in bold" in messages[0]["content"]
    assert '"model_score": 0.91' in messages[1]["content"]
    assert '"version": "v1"' in messages[1]["content"]
    assert len(messages)==23


@pytest.mark.parametrize("code,status",[("timeout",504),("rate_limited",429),("chat_unavailable",503)])
def test_provider_failure_codes(client,monkeypatch,code,status):
    def fail(*args): raise chatbot.ChatUnavailable(code)
    monkeypatch.setattr(main,"ai_chat",fail)
    assert client.post("/chat",json=payload()).status_code==status


def test_predict_contract(client, monkeypatch):
    monkeypatch.setattr(main,"predict_from_image_bytes",lambda image:("Pneumonia",.91))
    monkeypatch.setattr(main,"model_metadata",lambda:{"version":"test-only","calibrated":True})
    response=client.post("/predict",files={"file":("x.png",png(),"image/png")},data={"language":"hi"})
    assert response.status_code==200
    assert response.json()["model_version"]=="test-only"
    assert chatbot.COPY["hi"]["Pneumonia"] in response.json()["chat_response"]
