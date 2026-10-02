# Security assessment — 2 October 2026

## Remediated

- Removed untrained inference fallback; only checksum-verified ONNX plus explicitly validated metadata can serve screening. Legacy research export is rejected.
- Verified decoded JPEG/PNG/WEBP, 10 MB upload and 20 MP decoded limits; bounded streamed request bodies and text.
- Restricted chat roles to user/assistant, 20 prior messages, 2,000 characters each; system instructions originate on the server.
- Added per-client rate limiting, bounded rate-limit storage, single-task inference/chat capacity, provider timeouts with no automatic retries, and localized failures.
- Keys remain backend-only. No medical history persists in local storage; history clear/unmount revokes image URLs. Optional report identity never enters chatbot requests.
- React escapes report fields; exported HTML tests reject executable script interpolation. Chat Markdown does not enable raw HTML.
- Explicit CORS origins, no credentials, no-store and nosniff responses; deployment files exclude raw data, training runtimes and secrets.
- Updated frontend dependencies, removed the vulnerable development tagger/tooling chain, pinned Python serving/training graphs. The final saved npm and pip-audit snapshots contain zero known dependency vulnerabilities.

## Evidence

- 21 backend tests pass: malformed/oversized uploads, chunked bodies, decoded pixel limits, missing models, chat role/history rejection, API context, standalone chat, provider errors, rate limits, cleaning reproducibility and patient/duplicate separation.
- 25 frontend tests pass: language payloads, bounded model context, private history cleanup, urgent-warning styling, safe score labels, chat reset, report fields, no-screening report, escaped A4 HTML export and integrated fixture workspace flow.
- Production build and TypeScript pass. Lint: zero errors, seven existing shadcn Fast Refresh warnings.
- Live Groq synthetic context replies: HTTP 200 in English, Hindi and Marathi; evidence in verification/live-chat.json. No real patient information was transmitted in these checks.

## Remaining limits

This is an unauthenticated educational demo. Process-local limits assume one worker; they do not stop distributed abuse. CORS is not authentication. Prompt constraints cannot prove clinical safety or eliminate prompt injection. Images are not reliably verified as chest X-rays. A production medical application requires a separate privacy, clinical, authentication and operational assessment.

The promoted NIH ResNet18 candidate improves balanced accuracy and ROC-AUC on the held-out test split, with a 6.7-point sensitivity reduction versus the legacy baseline. This tradeoff and the report-derived labels require clear presentation; no clinical validity is claimed. The baseline checkpoint has unknown provenance and class semantics. ONNX parity and Windows inference measurements do not establish full API memory on Render Linux. Validate memory and live API flows after deployment.

The in-app browser did not expose a report Blob-download event. Automated tests verify its complete escaped Unicode HTML. Native browser download/printing and Playwright fixture scenarios remain to be confirmed before publishing.
