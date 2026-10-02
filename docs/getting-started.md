# Getting started

## Requirements

- Python 3.11 for the API and data/model tools.
- Node.js and npm for the React frontend.
- Git for source control.
- A Groq API key to use the assistant; configure it in the local backend or in Render for production.
- For training, a CUDA-capable GPU is recommended. CPU training is supported but substantially slower.

## Start the API

From the repository root in PowerShell:

```powershell
cd 'AOML Deploy/backend'
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.lock.txt
Copy-Item .env.example .env
```

Edit `.env` locally:

```dotenv
CORS_ORIGINS=http://localhost:8080,http://127.0.0.1:8080,http://127.0.0.1:8081
MODEL_PATH=models/pneumonia_model.onnx
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-120b
```

Keep the key private. Start the server:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The checked-in ONNX model and JSON metadata sidecar are used by default. Visit [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health) and [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs). Health returns 503 if the model is absent, has a checksum mismatch, or fails metadata validation.

The conversational assistant requires `GROQ_API_KEY`. Without it, `GET /chat/status` reports `configured: false`, and `POST /chat` returns a service-unavailable response. `GROQ_MODEL` is optional; the current code default is `openai/gpt-oss-120b`.

## Start the frontend

Open a second PowerShell terminal:

```powershell
cd 'AOML Deploy/radi-ai-buddy-main/radi-ai-buddy-main'
npm ci
Copy-Item .env.example .env
```

Set this in the frontend `.env`:

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Then run:

```powershell
npm run dev
```

Open the Vite URL shown in the terminal. The API's default local CORS allowlist covers ports 8080 and 8081. If Vite chooses another port, add that exact origin to `CORS_ORIGINS` and restart the API.

## Dependency groups

- `requirements.lock.txt`: lean API serving dependencies, including ONNX Runtime CPU.
- `requirements-dev.lock.txt`: development, testing, cleaning, EDA, and training dependencies.
- Frontend `package-lock.json`: pinned npm dependency graph; use `npm ci` for reproducible installs.

Use the serving lock for a quick local API run. The development lock is larger and is needed for backend tests, NIH cleaning/EDA, and PyTorch training.

## Tests and checks

Install the larger backend development lock before running Python tests or audit commands. From `AOML Deploy/backend`:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.lock.txt
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m pip_audit
```

Frontend, from `AOML Deploy/radi-ai-buddy-main/radi-ai-buddy-main`:

```powershell
npm run test
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm run build
npm audit
```

For report generation and user-facing flows, see [Verification](verification.md). For the full dataset workflow, see [Data and model](data-and-model.md).
