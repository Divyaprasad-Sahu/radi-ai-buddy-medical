# Radiant React frontend

See the workspace root README.md for setup and measured limitations. Run npm ci, npm run dev. Set VITE_API_BASE_URL to the backend URL.

The supplied frontend retains its upload, language selector, chatbot, history and reports, with a refreshed professional interface. The assistant calls Groq through the backend; credentials never belong in Vite variables. Chat works before upload and receives selected screening context when available. Reports support private optional patient details, downloadable HTML and browser Print / Save PDF. Screening requires a validated model; no test fixture is served as a real result.

Checks: npm run test, npm run lint, npx tsc -p tsconfig.app.json --noEmit, npm run build, npm audit.
