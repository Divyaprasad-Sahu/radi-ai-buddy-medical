# Radiant

Radiant is a multilingual educational chest X-ray screening demo. It combines the supplied React interface, a FastAPI inference service, a checksum-validated ONNX ResNet18 model, and a Groq-backed health information assistant. It supports English, Hindi, and Marathi.

**Not for diagnosis or treatment.** A screening result is not a medical diagnosis, and a “No Finding” result does not rule out illness. Consult a qualified clinician. Seek emergency care for severe or rapidly worsening symptoms.

## Live application

- Frontend: [radi-ai-buddy-medical.vercel.app](https://radi-ai-buddy-medical.vercel.app/)
- API: [radi-ai-buddy-api.onrender.com](https://radi-ai-buddy-api.onrender.com/)
- API readiness: [/health](https://radi-ai-buddy-api.onrender.com/health)
- Private source repository: [Divyaprasad-Sahu/radi-ai-buddy-medical](https://github.com/Divyaprasad-Sahu/radi-ai-buddy-medical)

The Vercel project builds from `AOML Deploy/radi-ai-buddy-main/radi-ai-buddy-main`; the Render service serves the backend in `AOML Deploy/backend`. See [deployment](docs/deployment.md) for configuration and secret handling.

## Capabilities

- Upload a JPG, PNG, or WEBP chest X-ray for a pneumonia-pattern screening result.
- Ask the Groq-backed assistant general health questions or ask it to explain the selected screening result. Result context is sent only when a result is selected.
- Switch the interface and AI replies among English, Hindi, and Marathi.
- Create a structured educational report preview and download it as HTML or print/save it as PDF.
- Review session history and aggregate research/model information.

## Run locally

1. Start the backend from PowerShell:

   ```powershell
   cd 'AOML Deploy/backend'
   python -m venv .venv
   .\.venv\Scripts\python.exe -m pip install -r requirements.lock.txt
   Copy-Item .env.example .env
   .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
   ```

2. In a second terminal, start the frontend:

   ```powershell
   cd 'AOML Deploy/radi-ai-buddy-main/radi-ai-buddy-main'
   npm ci
   ```

   Create the frontend `.env` from `.env.example` and set `VITE_API_BASE_URL=http://127.0.0.1:8000`, then run:

   ```powershell
   npm run dev
   ```

   Open the URL printed by Vite, usually `http://localhost:8080`. The development API CORS default allows ports 8080 and 8081.

The assistant requires a Groq key to answer. Put `GROQ_API_KEY` in the backend `.env` for local use; never put it in the frontend `.env`, Git, or a `VITE_*` variable. Full installation, environment settings, and test commands are in [Getting started](docs/getting-started.md).

## Documentation

| Guide | What it covers |
|---|---|
| [Architecture](docs/architecture.md) | Frontend, API, model, assistant, and report flow |
| [Getting started](docs/getting-started.md) | Local development, dependencies, environment variables, and tests |
| [Data and model](docs/data-and-model.md) | NIH provenance, cleaning/EDA, training, evaluation, and model limitations |
| [API reference](docs/api-reference.md) | Routes, payloads, limits, and error responses |
| [Deployment](docs/deployment.md) | Current Vercel/Render deployment and redeploy configuration |
| [Security and privacy](docs/security-and-privacy.md) | Upload protections, secrets, retention, and known limits |
| [Verification](docs/verification.md) | Automated checks and live smoke-test status |
| [Security assessment](SECURITY.md) | Recorded dependency and application security review |

## Current model snapshot

The serving artifact is ResNet18 `nih-resnet18-15aada8cb8ca`. On the recorded held-out NIH test partition it achieved 66.7% balanced accuracy, 75.1% sensitivity, 58.2% specificity, 9.2% precision, 16.4% F1, and 0.731 ROC-AUC. Its baseline comparison had 60.7% balanced accuracy and 81.8% sensitivity. Thus, the candidate improves balanced accuracy while sensitivity is lower than the legacy baseline. The small positive class and report-derived labels make these estimates uncertain; they are not clinical validation.

The included aggregate cleaning record reports 112,120 images found and 61,792 included images from 25,052 patients, including 1,431 pneumonia examples. It also records that the model cohort was produced in a fast pass without exhaustive image-integrity and near-duplicate checks. The cleaning script now implements those checks, but the raw images and row-level manifest are intentionally absent from Git. Treat the shipped metrics as research results, not as proof that every current artifact can be reproduced from the repository alone. More detail is in [Data and model](docs/data-and-model.md).

## License and dataset

Review the NIH ChestX-ray14 release terms and attribution before redistributing dataset files. The app repository excludes the raw images and patient-level manifests. See the [official NIH release](https://nihcc.app.box.com/v/ChestXray-NIHCC) and the data guide.
