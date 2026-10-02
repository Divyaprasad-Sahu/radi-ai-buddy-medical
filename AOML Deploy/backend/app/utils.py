LANGUAGE_LABEL_TO_CODE = {
    "english": "en",
    "hindi": "hi",
    "marathi": "mr",
    "en": "en",
    "hi": "hi",
    "mr": "mr",
}

SUPPORTED_LANGS = {"en", "hi", "mr"}
DISCLAIMER = "Consult a doctor for medical advice."
CONFIDENCE_THRESHOLD = 0.8


def normalize_language(language: str | None) -> str:
    if not language:
        return "en"
    normalized = language.strip().lower()
    return LANGUAGE_LABEL_TO_CODE.get(normalized, "en")


def format_percent(value: float) -> str:
    return f"{value * 100:.1f}%"


def apply_confidence_threshold(disease: str, confidence: float) -> str:
    if confidence < CONFIDENCE_THRESHOLD:
        return "Uncertain"
    return disease
