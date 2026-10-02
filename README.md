# Multilingual NIH X-ray screening demo

The existing React frontend is preserved. The FastAPI backend serves only checksum-verified ONNX artifacts; an unverified historic checkpoint never produces public predictions. This is an educational screening demo, not a clinical diagnostic system.

## Local run (PowerShell)

Backend directory: `AOML Deploy/backend`

```powershell
cd 'AOML Deploy/backend'
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements-dev.lock.txt
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Frontend directory: `AOML Deploy/radi-ai-buddy-main/radi-ai-buddy-main`

```powershell
npm ci
npm run dev
```

Set `VITE_API_BASE_URL=http://127.0.0.1:8000` in the frontend environment. Default frontend port is 8080; if occupied, Vite uses the next port. The development API allows 8080 and 8081. Configure other origins explicitly with `CORS_ORIGINS`.

English, Hindi, and Marathi are supported throughout screening, errors, chat and reports. The assistant uses Groq directly, including before an image is uploaded. There is no local chatbot or external-AI toggle. Sending a question transmits the message, bounded conversation history and selected screening context (finding, score, version, calibration and symptoms) to Groq. A short notice accompanies the composer. The API key stays on the backend. History stays in memory and is cleared on reload. Language and theme preferences remain in local storage. No server-side medical history is stored.

## Official NIH data, cleaning and EDA

From the backend directory:

```powershell
.\venv\Scripts\python.exe download_nih.py --archives 1
.\venv\Scripts\python.exe clean_nih.py
```

The downloader uses NIH's official Box release, records source URLs and SHA-256 checksums, safely extracts regular archive files, and never executes the downloaded NIH script. Use `--archives 12` for the full release; the trained model used a 112,120-image cohort. Raw images and metadata files are excluded from Git. The local image copies were removed after training to reclaim disk space; the trained ONNX model and small aggregate reports are retained for deployment.

Cleaning emits `data/processed/manifest.csv`, `exclusions.csv`, `cleaning.json`, `eda.html`, and `eda.ipynb`. Open the notebook in its output directory. The deployed research cohort contains 61,792 Pneumonia or No Finding images from 25,052 patients, including 1,431 Pneumonia examples. Other findings are excluded rather than treated as normal. Patient-level partitions preserve the official test assignment. No Finding is not proof of health.

NIH labels were extracted from reports and can be erroneous. The minority class is much smaller than the comparison class, so metrics are sensitive to the selected threshold and cohort. These results are research measurements, not clinical validation.

Source: https://nihcc.app.box.com/v/ChestXray-NIHCC

Requested attribution: Wang X, Peng Y, Lu L, Lu Z, Bagheri M, Summers RM. *ChestX-ray8: Hospital-scale Chest X-ray Database and Benchmarks on Weakly-Supervised Classification and Localization of Common Thorax Diseases*. CVPR 2017, pp. 3462–3471. https://arxiv.org/abs/1705.02315

Review the NIH release documentation before redistributing dataset files. Deployment includes the validated serving model and aggregate cohort/evaluation summaries, not raw images, patient-level manifests, or training data.

## Training and model selection

```powershell
.\venv\Scripts\python.exe train.py --epochs 10 --batch-size 16
```

Training uses pretrained ResNet18, trains its final residual block and classifier, class-weighted loss, conservative rotation augmentation, seed 42 and early stopping after three non-improving validation epochs. The old model is loaded with `weights_only=True`, evaluated on the same validation data and documented as having unknown provenance.

Promotion requires higher validation balanced accuracy without lower pneumonia sensitivity. Model selection happens before test evaluation. Temperature scaling uses validation data only. The report includes sensitivity, specificity, precision, F1, ROC-AUC, confusion matrices, Brier score, calibration error and abstention rate at 0.8 confidence.

A promoted candidate produces `artifacts/pneumonia_model.onnx`, matching `.json` metadata, `candidate.pth` and `evaluation.json`. The selected ResNet18 candidate improved validation balanced accuracy while matching baseline validation sensitivity; its test sensitivity was lower than the baseline. ONNX parity was verified on validation images. The legacy baseline's provenance and class semantics are unverified.

```powershell
.\venv\Scripts\python.exe benchmark_inference.py --model artifacts/pneumonia_model.onnx --image data/raw/images/00000001_000.png
```

Install a promoted model by copying its ONNX and JSON files together into `models/`, or set `MODEL_PATH` to its ONNX path. `/health` returns HTTP 503 while missing or invalid, rather than falsely reporting readiness. Never create validation metadata for a random or untrained model.

## Render and Vercel

`render.yaml` configures one CPU-only ONNX worker on Render's free plan. `requirements.lock.txt` excludes PyTorch and training libraries. Deploy the frontend directory to Vercel with `npm ci`, `npm run build`, output `dist`, and `VITE_API_BASE_URL=https://YOUR-BACKEND.onrender.com`. SPA routing and response headers are provided in `vercel.json`. Configure backend `CORS_ORIGINS` to the exact Vercel production/approved preview origins; never use a wildcard.

A Git remote and connected hosting accounts are required for publishing. The repository includes the 44.7 MB validated ONNX serving model and matching metadata; raw images, patient-level manifests, training checkpoints, and local secrets remain excluded. Render validates the model during build. Do not train or download NIH images during deployment. Groq credentials stay in Render's environment, never Vite variables. Set `GROQ_API_KEY` on the backend and `GROQ_MODEL` to a model available to that account. Missing keys or provider failures return clear errors; no local chatbot is substituted.

Measure full API memory on Render Linux before considering the free deployment verified. The benchmark reserves headroom by requiring sampled inference RSS below 384 MB; it does not prove peak API memory is below 512 MB. Free-host cold starts can trigger the frontend's 30-second timeout. Training is offline only.

## Security and checks

Uploads are capped at 10 MB and 20 megapixels. The API bounds streamed request bodies, verifies decoded PNG/JPEG/WEBP formats, restricts chat roles and history, and applies a 10-requests/minute/client limit with one concurrent inference/chat task. Provider calls have a 18-second timeout and no retries. Responses use no-store and nosniff headers. Errors and logs omit symptoms, chat content and filenames.

Rate limiting is process-local and intended for a single-worker college demo. CORS is browser isolation, not authentication. A public endpoint still needs platform-level abuse controls for serious use; prompt restrictions do not eliminate semantic prompt injection. There is no general chest-X-ray detector or clinical deployment validation.

```powershell
# Backend
.\venv\Scripts\python.exe -m pytest -q
.\venv\Scripts\python.exe -m pip_audit
# Frontend
npm run test
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm run build
npm audit
```

Audit evidence is saved in `backend/security-audit-python.json` and the frontend's `security-audit-npm.json`. Unit/integration tests cover three languages, API payloads, API-only chat, model context, provider failures, structured report previews, history deletion, upload abuse, chat role validation, model unavailability, cleaning reproducibility and leakage. Playwright scenarios are supplied under `e2e`; run against an isolated frontend/API instance. Fixture predictions are explicitly test-only and are not trained model results.

## Professional workspace and reports

The supplied React app now has a Radiant visual identity, a redesigned landing page and workspace, an API assistant with suggested questions, Markdown, copy, stop and new-conversation controls, preview-only brightness/contrast inspection, session history, and an aggregate research panel. Conversations survive tab switches and reset when the selected screening or language changes.

**Create report** opens a structured preview with optional patient identity, symptoms, findings, score, model details and reviewer notes. Download saves a self-contained Unicode HTML report. **Print / save PDF** opens browser printing; select Save as PDF there. Patient fields stay in browser memory and are not sent to the chatbot. Reports are explicitly educational AI screening summaries, with no invented physician, signature or confirmed diagnosis. Without a model result, the report clearly marks screening as Not performed, records only the supplied context and does not invent findings.

## Measured local outcome

The model cohort contains 61,792 images from 25,052 patients, including 1,431 Pneumonia examples. On validation, the candidate reached 69.6% balanced accuracy and 58.9% sensitivity, versus 63.0% and 58.9% for the baseline. On the held-out NIH test split, the candidate reached 66.7% balanced accuracy, 75.1% sensitivity, 58.2% specificity and 0.731 ROC-AUC. The baseline reached 60.7% balanced accuracy, 81.8% sensitivity, 39.6% specificity and 0.661 ROC-AUC. The candidate improves balanced accuracy and specificity but lowers test sensitivity by 6.7 percentage points. These are research results on report-derived labels, not clinical validation.

Screening uses the promoted ResNet18 candidate. ONNX parity maximum absolute error was 0.00000358 across eight validation images. Local API health and model readiness were verified. Full API/Linux Render memory and live production prediction/report flows still require post-deployment verification.

Current verification: 21 backend tests, 25 frontend tests, TypeScript and production build pass. Saved npm and Python dependency audit snapshots report zero known vulnerabilities. ESLint has zero errors and seven existing shadcn Fast Refresh warnings. Live Groq replies were checked in English, Hindi and Marathi. Report rendering and model-context flows use explicit test fixtures, not invented live predictions.

The in-app browser displayed the report preview but did not expose a Blob-download event; exported HTML content is verified in automated tests. Confirm browser download and Save as PDF in Chrome/Edge before publishing. Playwright fixture scenarios are updated for all languages but were not run in this session.
