# Security and privacy

Radiant is an educational demo, not a production medical record system. It has no user authentication, user accounts, database, or server-side patient-history storage.

## Secrets

- `GROQ_API_KEY` belongs only in the backend environment: Render for production or the ignored backend `.env` for local development.
- Never put the key in frontend configuration, source, screenshots, GitHub issues, or chat.
- `VITE_*` values are public because Vite embeds them in the built site.
- Rotate a key immediately if it is exposed. Do not read secrets into logs.

## Data sent to providers

For image screening, the browser sends the selected image and optional symptom text to the Radiant API. The API performs in-memory decode/inference and does not write the image or symptoms to an application database.

For a chat turn, the backend sends the new question, selected language, at most 20 prior user/assistant messages, and any selected model finding/score/version/calibration and symptoms to Groq. Do not enter names, contact information, medical record numbers, or other identifying details into chat. The UI discloses that messages are processed by Groq.

The report builder runs in the browser. Optional identity and reviewer fields remain client-side and are not sent through the chat API. Session image history is held in memory; object URLs are revoked on clear/removal/unmount. Language and theme preferences use local storage; medical history is not stored there.

Provider retention and processing are governed by the relevant provider terms and account settings; this application cannot guarantee provider-side deletion or retention behavior.

## Input and request protections

- Upload content types are restricted to JPEG, PNG, and WEBP and verified against decoded image format.
- Upload limit: 10 MiB; decoded image limit: 20 megapixels.
- Streamed POST bodies are bounded, and chat text/history are size-limited.
- Chat roles are limited to `user` and `assistant`; extra JSON fields are rejected.
- Requests are rate-limited per client IP and inference/chat are concurrency-limited.
- Provider requests use an 18-second timeout with no automatic retry.
- CORS is exact-origin allowlisting, not authentication or authorization.
- Responses set `no-store` and `nosniff`; application error logs avoid message text and filenames.
- Only checksum-verified ONNX weights with validated metadata can serve predictions. Missing/invalid weights produce HTTP 503.

## Operational limitations

Rate limits are process-local. They assume one backend worker and do not protect against distributed abuse or coordinated clients. CORS is not an API firewall. Public deployment would need authentication, durable abuse controls, privacy/legal review, monitoring, and a clinical governance process.

The service cannot verify that an image is a chest radiograph. The model can be wrong, and the NIH labels are report-derived. Never rely on the app for diagnosis, triage, medication, or emergency decisions. Severe breathing difficulty, chest pain, confusion, or rapidly worsening symptoms need urgent professional care.

See [SECURITY.md](../SECURITY.md) for the dated dependency and application assessment.
