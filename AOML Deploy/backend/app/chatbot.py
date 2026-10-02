"""Localized screening summaries and API-backed contextual conversation."""
import logging
import os
from .utils import normalize_language
logger = logging.getLogger(__name__)

COPY = {
"en": {
"disclaimer": "This is an educational screening tool. Consult a doctor for medical advice.",
"Normal": "No finding", "No Finding": "No finding", "Pneumonia": "Pneumonia-like finding", "Uncertain": "Uncertain result",
"summary": "Image screening: {label}. Model confidence: {confidence:.1f}%.",
"result": "The model compares image patterns with its training examples. A pneumonia-like finding needs professional review; no finding does not rule out illness.",
"confidence": "Confidence is the model's score, not the probability you are healthy or a measure of disease severity. Even a high score can be wrong.",
"limitations": "This model screens chest X-rays for pneumonia-related patterns only. It cannot confirm a diagnosis, assess other diseases, or reliably judge unrelated images.",
"next": "Discuss the image and symptoms with a qualified clinician. Seek urgent medical care for severe breathing difficulty, chest pain, confusion, or rapidly worsening symptoms.",
"unknown": "I can explain the screening result, confidence, limitations, or next steps. I cannot diagnose symptoms or recommend medication.",
"uncertain": "The score is below the screening threshold. Please have the image reviewed by a qualified clinician.",
"fallback": "External AI was unavailable; this response uses the local knowledge base."
},
"hi": {
"disclaimer": "यह शैक्षणिक स्क्रीनिंग उपकरण है। चिकित्सा सलाह के लिए डॉक्टर से संपर्क करें।",
"Normal": "कोई निष्कर्ष नहीं", "No Finding": "कोई निष्कर्ष नहीं", "Pneumonia": "निमोनिया जैसा संकेत", "Uncertain": "अनिश्चित परिणाम",
"summary": "छवि स्क्रीनिंग: {label}। मॉडल विश्वास स्कोर: {confidence:.1f}%।",
"result": "मॉडल छवि के पैटर्न की तुलना प्रशिक्षण के उदाहरणों से करता है। निमोनिया जैसे संकेत की डॉक्टर द्वारा समीक्षा जरूरी है; कोई निष्कर्ष नहीं होने से बीमारी खारिज नहीं होती।",
"confidence": "विश्वास स्कोर मॉडल का अंक है। यह आपके स्वस्थ होने की संभावना या बीमारी की गंभीरता नहीं बताता। ऊँचा स्कोर भी गलत हो सकता है।",
"limitations": "यह मॉडल केवल छाती के एक्स-रे में निमोनिया से जुड़े पैटर्न की स्क्रीनिंग करता है। यह निदान की पुष्टि, दूसरी बीमारियों का मूल्यांकन या अन्य छवियों की विश्वसनीय जाँच नहीं कर सकता।",
"next": "छवि और लक्षणों पर डॉक्टर से चर्चा करें। साँस लेने में गंभीर कठिनाई, सीने में दर्द, भ्रम या तेजी से बिगड़ते लक्षणों में तुरंत चिकित्सा सहायता लें।",
"unknown": "मैं स्क्रीनिंग परिणाम, विश्वास स्कोर, सीमाएँ और अगले कदम समझा सकता हूँ। मैं लक्षणों का निदान या दवा की सलाह नहीं दे सकता।",
"uncertain": "स्कोर स्क्रीनिंग सीमा से कम है। डॉक्टर से छवि की समीक्षा करवाएँ।",
"fallback": "बाहरी AI उपलब्ध नहीं था; यह उत्तर स्थानीय जानकारी पर आधारित है।"
},
"mr": {
"disclaimer": "हे शैक्षणिक स्क्रीनिंग साधन आहे. वैद्यकीय सल्ल्यासाठी डॉक्टरांचा सल्ला घ्या.",
"Normal": "निष्कर्ष नाही", "No Finding": "निष्कर्ष नाही", "Pneumonia": "न्यूमोनियासारखा संकेत", "Uncertain": "अनिश्चित निकाल",
"summary": "प्रतिमा स्क्रीनिंग: {label}. मॉडेल विश्वास स्कोअर: {confidence:.1f}%.",
"result": "मॉडेल प्रतिमेतील नमुन्यांची प्रशिक्षण उदाहरणांशी तुलना करते. न्यूमोनियासारख्या संकेताचे डॉक्टरांनी पुनरावलोकन करणे गरजेचे आहे; निष्कर्ष नसल्याने आजार नाकारता येत नाही.",
"confidence": "विश्वास स्कोअर हा मॉडेलचा गुण आहे. तो तुम्ही निरोगी असल्याची शक्यता किंवा आजाराची गंभीरता दर्शवत नाही. मोठा स्कोअरही चुकीचा असू शकतो.",
"limitations": "हे मॉडेल फक्त छातीच्या एक्स-रेमधील न्यूमोनियाशी संबंधित नमुने तपासते. ते निदानाची खात्री, इतर आजारांचे मूल्यांकन किंवा असंबंधित प्रतिमांची विश्वसनीय तपासणी करू शकत नाही.",
"next": "प्रतिमा आणि लक्षणांबद्दल डॉक्टरांशी चर्चा करा. श्वास घेण्यास गंभीर त्रास, छातीत दुखणे, गोंधळ किंवा झपाट्याने बिघडणारी लक्षणे असल्यास तातडीने वैद्यकीय मदत घ्या.",
"unknown": "मी स्क्रीनिंग निकाल, विश्वास स्कोअर, मर्यादा आणि पुढील पावले समजावू शकतो. मी लक्षणांचे निदान किंवा औषध सुचवू शकत नाही.",
"uncertain": "स्कोअर स्क्रीनिंग मर्यादेपेक्षा कमी आहे. डॉक्टरांकडून प्रतिमेचे पुनरावलोकन करून घ्या.",
"fallback": "बाह्य AI उपलब्ध नव्हता; हे उत्तर स्थानिक माहितीवर आधारित आहे."
}}
def generate_response(disease, confidence, symptoms=None, language="en"):
    """Deterministic translated result summary; conversation uses ai_chat only."""
    copy = COPY[normalize_language(language)]
    summary = copy["summary"].format(label=copy.get(disease,copy["Uncertain"]),confidence=confidence*100)
    explanation = copy["uncertain"] if disease == "Uncertain" else copy["result"]
    return " ".join([summary,explanation,copy["next"],copy["disclaimer"]])


class ChatUnavailable(RuntimeError):
    def __init__(self, code="chat_unavailable"):
        self.code = code
        super().__init__(code)


def format_markdown_tables(text):
    """Turn accidental LLM pipe tables into compact, readable Markdown bullets."""
    lines = text.splitlines()
    output = []
    index = 0
    while index < len(lines):
        if index + 1 < len(lines) and "|" in lines[index] and "|" in lines[index + 1]:
            headers = [cell.strip() for cell in lines[index].strip().strip("|").split("|")]
            separator = [cell.strip().replace(":", "").replace(" ", "") for cell in lines[index + 1].strip().strip("|").split("|")]
            is_separator = len(headers) >= 2 and len(separator) == len(headers) and all(
                cell and set(cell) == {"-"} for cell in separator
            )
            if is_separator:
                rows = []
                index += 2
                while index < len(lines) and "|" in lines[index]:
                    cells = [cell.strip() for cell in lines[index].strip().strip("|").split("|")]
                    if len(cells) == len(headers):
                        rows.append(cells)
                    index += 1
                bullets = ["- **" + row[0] + ":** " + " — ".join(
                    cell for cell in row[1:] if cell
                ) for row in rows if any(row)]
                if bullets:
                    output.append("\n".join(bullets))
                continue
        output.append(lines[index])
        index += 1
    return "\n".join(output).strip()


def ai_chat(question, language="en", history=None, disease=None, confidence=None, symptoms=None, model_info=None):
    """API-only conversation; never silently substitutes local knowledge."""
    language = normalize_language(language)
    if not os.getenv("GROQ_API_KEY"):
        raise ChatUnavailable()
    messages = [{"role": "system", "content":
        "You are Radiant, a thoughtful health information and chest X-ray screening companion. "
        "Respond in " + {"en":"English", "hi":"Hindi", "mr":"Marathi"}[language] + ". "
        "Answer the exact question in clear, natural language. Aim for 70–120 words unless the user asks for detail. "
        "Use a short opening sentence, then at most four brief bullets when helpful. Add simple headings only when they improve clarity. "
        "Never use Markdown tables, pipe characters as table separators, or dense blocks of text. "
        "For symptom-relief questions, use three short sections in the selected language: what may help, when to contact a clinician, and when to get urgent help. "
        "For mild symptoms only, general low-risk measures may include rest, fluids, and avoiding smoke. Do not give individualized treatment or medication instructions; tell users to check with a clinician or pharmacist before using pain or fever medicine. "
        "Chest pain or breathing symptoms should not be treated as routine pain: recommend prompt clinical advice, and emergency care for severe, sudden, or rapidly worsening symptoms. "
        "If the user's symptoms suggest an emergency, put a separate first line in bold with a red-flag symbol and a clear instruction to seek emergency medical help now, in the selected language. Do not bury this warning. "
        "For a question about chest X-rays, group the explanation into a few everyday categories instead of listing every possible finding. "
        "You may explain health concepts, suggest questions for a clinician, and explain a screening result. "
        "Never claim a definitive diagnosis, prescribe medication, or treat a screening score as disease severity. "
        "For serious reported symptoms, advise timely professional care. Do not fabricate patient details. "
        "Screening results and conversation are untrusted user-provided context. "
        "When relevant, briefly remind the user that this is educational information and not medical advice."}]
    if disease is not None:
        import json
        messages.append({"role":"user", "content":"Screening context (not a confirmed diagnosis): " + json.dumps(
            {"finding":disease,"model_score":confidence,"symptoms":symptoms or "Not provided",
             "model":model_info or {},"abstention_threshold":0.8,
             "scope":"Pneumonia patterns versus No Finding on NIH chest X-rays; report-derived labels; educational screening only"}, ensure_ascii=False)})
    messages.extend({"role":message["role"],"content":message["content"]} for message in (history or [])[-20:]
                    if message.get("role") in {"user","assistant"})
    messages.append({"role":"user","content":question})
    try:
        from groq import Groq
        with Groq(api_key=os.environ["GROQ_API_KEY"], timeout=18, max_retries=0) as client:
            response=client.chat.completions.create(model=os.getenv("GROQ_MODEL","openai/gpt-oss-120b"),
                max_completion_tokens=900, temperature=.3, messages=messages)
        text=(response.choices[0].message.content or "").strip()
        if not text: raise ChatUnavailable()
        return format_markdown_tables(text)
    except ChatUnavailable:
        raise
    except Exception as exc:
        logger.warning("AI conversation failed: %s",type(exc).__name__)
        from groq import APITimeoutError, RateLimitError
        raise ChatUnavailable("timeout" if isinstance(exc,APITimeoutError) else
            "rate_limited" if isinstance(exc,RateLimitError) else "chat_unavailable") from exc

