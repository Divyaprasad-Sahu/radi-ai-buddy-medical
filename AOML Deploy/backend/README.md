# Radiant API and model pipeline

This directory contains the FastAPI service, ONNX model artifact, NIH data-cleaning/EDA pipeline, and offline training code.

## Run the API

From this directory:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.lock.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The serving-only dependency lock is `requirements.lock.txt`; development, tests, cleaning, EDA, and training use the larger `requirements-dev.lock.txt`. Configure the frontend's `VITE_API_BASE_URL` and the backend's exact `CORS_ORIGINS`.

## Routes

- `GET /health`: model readiness; returns 503 when the validated ONNX model cannot load.
- `POST /predict`: multipart image screening.
- `POST /chat`: Groq-backed chat; the API key stays on the backend.
- `POST /explain`: deterministic localized result explanation.
- `GET /chat/status`: whether a Groq key is configured.
- `GET /insights`: aggregate cohort and evaluation information.
- `GET /docs`: interactive OpenAPI documentation.

See [API reference](../../docs/api-reference.md), [Data and model](../../docs/data-and-model.md), and [Security and privacy](../../docs/security-and-privacy.md).

## Model

Only `models/pneumonia_model.onnx` with its checksum-verified JSON sidecar serves predictions. Current version: `nih-resnet18-15aada8cb8ca`. The legacy `.pth` checkpoint is not an inference fallback. Evaluation details and provenance limitations are documented in [Data and model](../../docs/data-and-model.md).

## Offline research workflow

The scripts `download_nih.py`, `clean_nih.py`, and `train.py` download from the official NIH Box release, prepare a patient-separated manifest/EDA, and fine-tune pretrained ResNet18. Raw images and row-level records are intentionally omitted from Git. See the full documented workflow before downloading the multi-gigabyte release or retraining.
