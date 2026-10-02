from io import BytesIO
import warnings
import numpy as np
from PIL import Image, ImageOps
from .model import get_model, model_metadata
from .utils import apply_confidence_threshold

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_PIXELS = 20_000_000
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/jpg", "image/webp"}
CLASS_NAMES = ["No Finding", "Pneumonia"]

def validate_upload(content_type):
    if not content_type or content_type.lower() not in ALLOWED_CONTENT_TYPES:
        raise ValueError("invalid_image")

def _load_image(image_bytes):
    if not image_bytes or len(image_bytes) > MAX_UPLOAD_BYTES:
        raise ValueError("invalid_image")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(image_bytes)) as image:
                if image.format not in {"JPEG", "PNG", "WEBP"} or image.width * image.height > MAX_PIXELS:
                    raise ValueError("invalid_image")
                image.verify()
            with Image.open(BytesIO(image_bytes)) as image:
                return ImageOps.exif_transpose(image).convert("RGB")
    except Exception as exc:
        raise ValueError("invalid_image") from exc

def preprocess_image(image_bytes):
    image = _load_image(image_bytes).resize((224, 224), Image.Resampling.BILINEAR)
    pixels = np.asarray(image, dtype=np.float32) / 255
    pixels = (pixels - np.array([.485, .456, .406], dtype=np.float32)) / np.array([.229, .224, .225], dtype=np.float32)
    return np.ascontiguousarray(pixels.transpose(2, 0, 1)[None])

def predict_from_image_bytes(image_bytes):
    tensor = preprocess_image(image_bytes)
    session = get_model()
    logits = np.asarray(session.run(None, {session.get_inputs()[0].name: tensor})[0][0], dtype=np.float64)
    if logits.shape != (2,) or not np.isfinite(logits).all():
        raise RuntimeError("Invalid model output")
    logits /= float(model_metadata()["temperature"])
    probabilities = np.exp(logits - logits.max())
    probabilities /= probabilities.sum()
    index = int(probabilities.argmax())
    confidence = float(probabilities[index])
    return apply_confidence_threshold(CLASS_NAMES[index], confidence), confidence

