# Deployment

## Production services

| Component | Provider | URL / configuration |
|---|---|---|
| Frontend | Vercel | [radi-ai-buddy-medical.vercel.app](https://radi-ai-buddy-medical.vercel.app/) |
| Backend | Render | [radi-ai-buddy-api.onrender.com](https://radi-ai-buddy-api.onrender.com/) |
| Git source | GitHub private repository | [radi-ai-buddy-medical](https://github.com/Divyaprasad-Sahu/radi-ai-buddy-medical), branch `main` |

The frontend Vercel project uses root directory `AOML Deploy/radi-ai-buddy-main/radi-ai-buddy-main`, the Vite preset, `npm run build`, and output directory `dist`. Its production and preview `VITE_API_BASE_URL` points to the Render API. The included frontend `vercel.json` provides SPA routing and basic response headers.

The Render service is `radi-ai-buddy-api` in Singapore on the free Python web-service plan. It runs one Uvicorn worker and loads `models/pneumonia_model.onnx` plus its JSON sidecar. `/health` is the intended readiness path. The serving dependency lock excludes PyTorch and the training stack.

## Required environment

### Vercel

| Variable | Value | Secret? |
|---|---|---|
| `VITE_API_BASE_URL` | `https://radi-ai-buddy-api.onrender.com` | No |

Vite variables are embedded in client-side JavaScript at build time. Never store provider credentials in Vercel `VITE_*` variables.

### Render

| Variable | Purpose |
|---|---|
| `CORS_ORIGINS` | Comma-separated exact allowed origins; include `https://radi-ai-buddy-medical.vercel.app` |
| `MODEL_PATH` | `models/pneumonia_model.onnx` |
| `PYTHON_VERSION` | `3.11.11` |
| `OMP_NUM_THREADS` | `1` |
| `GROQ_API_KEY` | Secret used by the backend for chat |
| `GROQ_MODEL` | Optional; code default is `openai/gpt-oss-120b` |

Set keys in Render's service Environment settings. Do not commit secrets. Restart/redeploy after changing them. `/chat/status` reports key presence but does not make a provider request.

## Updating production

The source repository is connected to both services and deploys from `main`. A reviewed push to `main` triggers new deployments. For a frontend-only change, Vercel builds the frontend root. For backend changes, Render builds the backend configuration. Confirm the deployed commit and status in both dashboards.

After changing the Vercel production domain, update Render `CORS_ORIGINS` to the exact new origin. Do not use wildcard CORS. Preview deployments may need an explicitly configured preview origin; avoid allowing every preview URL in production unless there is a deliberate policy.

## Render Blueprint

The repository-root `render.yaml` describes the backend service, health check, runtime variables, build command, and start command. It can be used when creating/reconciling a Render Blueprint. The currently deployed service was created with an explicit `cd "AOML Deploy/backend"` build/start command and an empty Render root-directory field, so compare the actual dashboard configuration before applying a Blueprint that could create or alter services.

## Free-tier behavior and limits

The Render free instance can spin down while idle, so the first request after inactivity can be slow. The API serializes inference/chat work and uses a single worker to reduce memory use. Dataset downloading and training are offline activities; they are not part of a production build. No patient dataset is needed at runtime.

## Post-deploy smoke checks

1. Open `/health`; expect HTTP 200, `model_ready: true`, and the current model version.
2. Open `/insights`; confirm aggregate cohort/model information is returned.
3. Open `/chat/status`; expect `configured: true` if chat should be enabled.
4. Load the Vercel frontend and check that the Research & model panel shows values from the API.
5. Ask a generic non-personal question in the chatbot and confirm a response.
6. For an end-to-end image test, use an approved synthetic/test image only; do not upload real patient data as a smoke test.

The last live verification confirmed frontend load, API-backed research metrics, and a generic Groq chatbot response. Real patient image uploads are intentionally not part of this documentation check.
