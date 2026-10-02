# Radiant frontend

This directory contains the supplied React + Vite frontend. It provides the landing page and imaging workspace, X-ray upload and result display, English/Hindi/Marathi language selection, Groq-backed chat UI, private session history, report preview/export, and research/model panel.

## Local development

```powershell
npm ci
Copy-Item .env.example .env
# Set VITE_API_BASE_URL=http://127.0.0.1:8000 in .env
npm run dev
```

The backend must be running and allow the exact Vite origin in `CORS_ORIGINS`. See the repository [Getting started guide](../../../docs/getting-started.md).

## Build and checks

```powershell
npm run test
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm run build
npm audit
```

## Deployment

Vercel project root: `AOML Deploy/radi-ai-buddy-main/radi-ai-buddy-main`. Build command: `npm run build`. Output directory: `dist`. Set `VITE_API_BASE_URL` to the deployed backend URL. The variable is public in the generated frontend; never put API keys in Vite variables.

See the repository [Deployment guide](../../../docs/deployment.md) and [Security and privacy guide](../../../docs/security-and-privacy.md).
