"""Build-time provisioning from explicit trusted artifact URLs; dataset never deployed."""
import hashlib
import json
import os
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import urlopen

target = Path(os.getenv("MODEL_PATH", "models/pneumonia_model.onnx"))
target.parent.mkdir(parents=True, exist_ok=True)

def fetch(variable, maximum):
    url = os.environ.get(variable, "")
    if urlparse(url).scheme != "https":
        raise SystemExit(f"Set {variable} to an HTTPS URL for the promoted artifact")
    with urlopen(url, timeout=60) as response:
        data = response.read(maximum + 1)
    if len(data) > maximum:
        raise SystemExit("Model artifact exceeds size limit")
    return data

if not target.exists() or not target.with_suffix(".json").exists():
    expected = os.environ.get("MODEL_ONNX_SHA256", "")
    if len(expected) != 64:
        raise SystemExit("Set MODEL_ONNX_SHA256 from the locally verified promoted artifact")
    binary = fetch("MODEL_ONNX_URL", 100 * 1024 * 1024)
    metadata_bytes = fetch("MODEL_METADATA_URL", 65536)
    metadata = json.loads(metadata_bytes)
    if hashlib.sha256(binary).hexdigest() != expected or metadata.get("sha256") != expected:
        raise SystemExit("Model artifact checksum mismatch")
    target.write_bytes(binary)
    target.with_suffix(".json").write_bytes(metadata_bytes)

os.environ["MODEL_PATH"] = str(target.resolve())
from app.model import get_model
get_model()
print("Validated ONNX artifact ready")
