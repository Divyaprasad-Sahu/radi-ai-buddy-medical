# FastAPI screening backend

See the workspace root README.md for setup, NIH download/cleaning/EDA, training, validation, security, and deployment instructions.

Runtime dependencies: requirements.lock.txt (ONNX CPU inference only).
Training/testing dependencies: requirements-dev.lock.txt.

GET /health returns 503 until a checksum-verified ONNX model and matching metadata are installed.
POST /predict accepts multipart file, language (en/hi/mr), and optional symptoms.
POST /chat uses Groq directly and accepts bounded user/assistant history, optional model context and selected language. No local chatbot fallback. GET /insights exposes aggregate research metrics only.

The legacy models/pneumonia_model.pth is evaluated offline with weights_only=True, and is never used as an unverified serving fallback.

## Current serving artifact

`models/pneumonia_model.onnx` is the fine-tuned NIH ChestX-ray14 ResNet18, version `nih-resnet18-15aada8cb8ca`; its JSON sidecar records the checksum, validation-fitted temperature, and evaluation provenance. The ONNX export matched PyTorch within `3.6e-6` maximum absolute logit error on eight validation images.

On the held-out official test partition, the candidate reached 0.667 balanced accuracy, 0.751 sensitivity, 0.582 specificity, 0.092 precision, 0.164 F1, and 0.731 ROC-AUC. The legacy checkpoint measured 0.607 balanced accuracy, 0.818 sensitivity, 0.396 specificity, 0.071 precision, 0.130 F1, and 0.661 ROC-AUC on the same partition. Sensitivity decreased, so these results are a research-demo comparison and do not establish clinical performance. NIH labels are report-derived; "No Finding" does not mean confirmed healthy. Do not use this app to make patient-care decisions.

The full evaluation and quick-cleaning limitations are in `artifacts/nih-resnet18-15aada8cb8ca/evaluation-full.json` and `artifacts/nih-resnet18-15aada8cb8ca/cleaning.json`.

