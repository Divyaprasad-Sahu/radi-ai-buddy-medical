# API reference

Base URL locally: `http://127.0.0.1:8000`

Production: `https://radi-ai-buddy-api.onrender.com`

FastAPI's interactive OpenAPI UI is available at `/docs`; the schema is at `/openapi.json`.

## `GET /health`

Returns model readiness and serving version.

```json
{"status":"ok","model_ready":true,"model_version":"nih-resnet18-15aada8cb8ca"}
```

If the ONNX model or validated sidecar is missing/invalid, returns HTTP 503 with `model_ready: false`. This route checks the screening model, not Groq availability.

## `POST /predict`

Multipart form data:

| Field | Required | Details |
|---|---|---|
| `file` | Yes | JPEG, PNG, or WEBP; maximum 10 MiB and 20 megapixels after decoding |
| `language` | No | `en`, `hi`, or `mr`; defaults to `en` |
| `symptoms` | No | At most 2,000 characters; used to tailor the localized screening explanation returned to the browser |

Successful response:

```json
{
  "disease": "Uncertain",
  "confidence": 0.706,
  "chat_response": "Localized educational screening explanation...",
  "model_version": "nih-resnet18-15aada8cb8ca",
  "calibrated": true
}
```

`disease` is `No Finding`, `Pneumonia`, or `Uncertain`. The confidence is a model score, not disease severity or a guarantee of health. The file is not persisted by the application.

## `POST /chat`

JSON body:

```json
{
  "question": "What are the limitations of this screening?",
  "language": "en",
  "history": [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}],
  "disease": "Uncertain",
  "confidence": 0.706,
  "model_version": "nih-resnet18-15aada8cb8ca",
  "calibrated": true,
  "symptoms": "optional symptom context"
}
```

Only `user` and `assistant` history roles are accepted. The history has at most 20 messages, each text field has a 2,000-character limit, and unknown fields are rejected. Screening context is optional; the frontend sends it only for a selected result. The backend sends the question, bounded conversation, language, and selected context to Groq. Response: `{"chat_response":"..." }`.

## `POST /explain`

Accepts a JSON body compatible with `/chat`, but requires `disease` and `confidence`. Returns a deterministic localized screening summary; this is separate from conversational Groq chat.

## `GET /chat/status`

Returns whether a Groq key is configured, not whether the provider is reachable:

```json
{"configured":true,"provider":"Groq"}
```

## `GET /insights`

Returns aggregate cleaning, evaluation, and model readiness fields for the research panel. It does not expose patient-level records or image data.

## Errors and limits

| HTTP | Meaning |
|---:|---|
| 400 | Invalid form/body or malformed image |
| 413 | Request exceeds upload/body size limit |
| 422 | Request schema or field validation failure |
| 429 | Per-client rate limit, provider rate limit, or inference/chat capacity busy |
| 503 | Model unavailable, Groq key missing, or chat provider unavailable |
| 504 | Groq request timeout |
| 500 | Unexpected inference failure |

All POST routes share a process-local limit of 10 requests per client IP per minute. Only one inference/chat task runs at a time; waiting longer than two seconds for the capacity slot returns 429. Responses include `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`. CORS permits only configured origins and does not authenticate callers.
