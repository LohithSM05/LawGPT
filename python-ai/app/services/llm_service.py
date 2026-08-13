import json

from ..core.config import settings
from ..core.logging import logger


class AnalysisError(Exception):
    """Raised when the LLM cannot be reached or its output is not usable JSON.
    Surfaces as a 422 from the /analysis/case route."""


def _extract_json(text: str) -> dict:
    """Gemini sometimes wraps JSON in ```json fences or adds preamble. Slice
    between the first '{' and the last '}' and parse strictly — never guess."""
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise AnalysisError("LLM returned no JSON object")
    candidate = text[start : end + 1]
    try:
        parsed = json.loads(candidate)
    except json.JSONDecodeError as exc:
        raise AnalysisError(f"LLM returned invalid JSON: {exc}") from exc
    if not isinstance(parsed, dict):
        raise AnalysisError("LLM JSON was not an object")
    return parsed


KANNADA_STUB_TEXT = "ಈ ಸಾರಾಂಶವು ಸ್ಥಿರ ಸ್ಟಬ್ ಔಟ್ಪುಟ್ ಆಗಿದೆ"  # "This summary is deterministic stub output"


def _stub_analysis(language: str, documents_hint: list[dict]) -> dict:
    """Deterministic canned output so the full pipeline (backend → python-ai →
    persistence → API) can be acceptance-tested without a Gemini API key.

    For language='kn' the narrative fields carry real Kannada Unicode so a test
    can assert the output actually contains Kannada characters end-to-end."""
    first_page = None
    if documents_hint and documents_hint[0].get("pages"):
        first_page = documents_hint[0]["pages"][0]["pageNumber"]

    docs = []
    for i, doc in enumerate(documents_hint, start=1):
        docs.append(
            {
                "sourceDocument": i,
                "summary": KANNADA_STUB_TEXT if language == "kn" else f"Deterministic stub summary for document {i}.",
                "keyPoints": (
                    [KANNADA_STUB_TEXT] if language == "kn" else [f"Stub key point one for document {i}."]
                ),
            }
        )

    return {
        "summary": {
            "text": KANNADA_STUB_TEXT if language == "kn" else "Deterministic stub case summary.",
            "keyPoints": [KANNADA_STUB_TEXT] if language == "kn" else ["Stub key point one.", "Stub key point two."],
        },
        "timeline": [
            {
                "event": KANNADA_STUB_TEXT if language == "kn" else "Stub timeline event",
                "date": None,
                "text": "",
                "sourceDocument": 1,
                "pageNumber": first_page,
            }
        ],
        "entities": [
            {
                "type": "person",
                "name": "ಸ್ಟಬ್ ವ್ಯಕ್ತಿ" if language == "kn" else "Stub Person",
                "mentions": 1,
                "sourceDocument": 1,
                "pageNumber": first_page,
            }
        ],
        "laws": [
            {
                "code": "IPC",
                "section": "420",
                "label": "Cheating and dishonestly inducing delivery of property",
                "description": "Stub description.",
                "relevance": "Stub relevance.",
                "sourceDocument": 1,
                "pageNumber": first_page,
            }
        ],
        "documents": docs,
    }


def generate_json(prompt: str, language: str = "en", documents_hint: list[dict] | None = None) -> dict:
    """Run the analysis prompt and return a parsed JSON object.

    Provider is selected by ``LLM_PROVIDER``:
    * "stub" — deterministic canned output (acceptance tests, no API key).
    * "gemini" — Google Generative AI (requires GEMINI_API_KEY).
    """
    documents_hint = documents_hint or []

    if settings.llm_provider == "stub":
        return _stub_analysis(language, documents_hint)

    if settings.llm_provider != "gemini":
        raise AnalysisError(f"Unknown LLM_PROVIDER: {settings.llm_provider}")

    if not settings.gemini_api_key:
        raise AnalysisError("GEMINI_API_KEY is not set — set it or use LLM_PROVIDER=stub")

    try:
        import google.generativeai as genai

        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel(settings.gemini_model)
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json", "temperature": 0.2},
        )
        text = response.text or ""
    except Exception as exc:  # network, auth, quota — anything from the SDK
        logger.warning("Gemini call failed: %s", exc)
        raise AnalysisError(f"LLM call failed: {exc}") from exc

    return _extract_json(text)