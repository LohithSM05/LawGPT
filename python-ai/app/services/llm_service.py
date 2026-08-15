import json
from typing import Any

from ..core.config import settings
from ..core.logging import logger


class AnalysisError(Exception):
    """Raised when the LLM cannot be reached or its output is not usable JSON."""


def _extract_json(text: str) -> dict:
    """Extract and strictly parse the first JSON object from model output."""
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


KANNADA_STUB_TEXT = "ಈ ಸಾರಾಂಶವು ಸ್ಥಿರ ಸ್ಟಬ್ ಔಟ್ಪುಟ್ ಆಗಿದೆ"


def _stub_analysis(language: str, documents_hint: list[dict]) -> dict:
    """Deterministic output used for acceptance testing without Gemini."""

    first_page = None

    if documents_hint and documents_hint[0].get("pages"):
        first_page = documents_hint[0]["pages"][0]["pageNumber"]

    docs = []

    for i, doc in enumerate(documents_hint, start=1):
        docs.append(
            {
                "sourceDocument": i,
                "summary": (
                    KANNADA_STUB_TEXT
                    if language == "kn"
                    else f"Deterministic stub summary for document {i}."
                ),
                "keyPoints": (
                    [KANNADA_STUB_TEXT]
                    if language == "kn"
                    else [f"Stub key point one for document {i}."]
                ),
            }
        )

    return {
        "summary": {
            "text": (
                KANNADA_STUB_TEXT
                if language == "kn"
                else "Deterministic stub case summary."
            ),
            "keyPoints": (
                [KANNADA_STUB_TEXT]
                if language == "kn"
                else ["Stub key point one.", "Stub key point two."]
            ),
        },
        "timeline": [
            {
                "event": (
                    KANNADA_STUB_TEXT
                    if language == "kn"
                    else "Stub timeline event"
                ),
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

# Preferred text-generation models.
#
# The order is only a preference. The actual API availability is checked
# against the models exposed to the current Gemini API key.
PREFERRED_MODELS = [
    "gemini-3.7-flash",
    "gemini-3.1-pro-preview",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-2.5-pro",
    "gemini-2.5-flash",
]


# Models that should never be selected for legal text analysis.
EXCLUDED_MODEL_TERMS = (
    "image",
    "tts",
    "live",
    "robotics",
    "deep-research",
    "computer-use",
    "nano-banana",
    "lyria",
)

_gemini_client: Any = None
_available_models: list[str] | None = None


def _get_gemini_client():
    """Create and cache the Google GenAI client."""
    global _gemini_client

    if _gemini_client is None:
        try:
            from google import genai

            _gemini_client = genai.Client(
                api_key=settings.gemini_api_key
            )
        except Exception as exc:
            raise AnalysisError(
                f"Unable to initialize Gemini client: {exc}"
            ) from exc

    return _gemini_client


def _model_id(name: str) -> str:
    """Convert models/foo into foo."""
    return name.split("/", 1)[1] if name.startswith("models/") else name


def _discover_available_models(force_refresh: bool = False) -> list[str]:
    """
    Discover Gemini models available to this API key that support
    generateContent.
    """
    global _available_models

    if _available_models is not None and not force_refresh:
        return _available_models

    client = _get_gemini_client()

    try:
        available = []

        for model in client.models.list():
            name = getattr(model, "name", "") or ""
            model_id = _model_id(name)

            supported_actions = getattr(
                model,
                "supported_actions",
                None,
            ) or []

            if "generateContent" not in supported_actions:
                continue

            lowered = model_id.lower()

            if any(
                term in lowered
                for term in EXCLUDED_MODEL_TERMS
            ):
                continue

            available.append(model_id)

        if not available:
            raise AnalysisError(
                "No Gemini models supporting generateContent "
                "are available to this API key."
            )

        _available_models = available

        logger.info(
            "Gemini generateContent models available: %s",
            ", ".join(available),
        )

        return available

    except AnalysisError:
        raise

    except Exception as exc:
        logger.warning(
            "Gemini model discovery failed: %s",
            exc,
        )

        raise AnalysisError(
            f"Unable to discover available Gemini models: {exc}"
        ) from exc


def _candidate_models() -> list[str]:
    """
    Return candidate models in preferred order.

    If GEMINI_MODEL is configured and available, it is placed first.
    Otherwise automatic preference order is used.
    """
    available = _discover_available_models()

    configured_model = getattr(
        settings,
        "gemini_model",
        None,
    )

    if configured_model:
        configured_model = _model_id(
            configured_model
        )

        if configured_model in available:
            preferred = [configured_model]

            logger.info(
                "Configured Gemini model will be tried first: %s",
                configured_model,
            )
        else:
            preferred = []

            logger.warning(
                "Configured Gemini model %s is not available. "
                "Using automatic model selection.",
                configured_model,
            )
    else:
        preferred = []

    for model in PREFERRED_MODELS:
        if model in available and model not in preferred:
            preferred.append(model)

    # Future-proof fallback for newly introduced Gemini models.
    fallback_models = [
        model
        for model in available
        if (
            "gemini" in model.lower()
            and "flash" in model.lower()
            and "preview" not in model.lower()
            and model not in preferred
        )
    ]

    for model in sorted(fallback_models):
        preferred.append(model)

    # Finally include any remaining compatible model.
    for model in sorted(available):
        if model not in preferred:
            preferred.append(model)

    return preferred


def _generate_with_gemini(prompt: str) -> str:
    """
    Generate JSON text.

    Models are attempted in preference order. If Gemini returns a
    temporary/unavailable error, the next compatible model is tried.
    """
    client = _get_gemini_client()

    candidates = _candidate_models()

    try:
        from google.genai import types
    except Exception as exc:
        raise AnalysisError(
            f"Unable to import Google GenAI types: {exc}"
        ) from exc

    errors = []

    for model in candidates:
        try:
            logger.info(
                "Trying Gemini model: %s",
                model,
            )

            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2,
                ),
            )

            text = response.text or ""

            if not text.strip():
                raise AnalysisError(
                    f"Gemini model {model} returned empty output."
                )

            logger.info(
                "Gemini generation succeeded with model: %s",
                model,
            )

            return text

        except Exception as exc:
            error_text = str(exc)

            logger.warning(
                "Gemini model %s failed: %s",
                model,
                error_text,
            )

            errors.append(
                f"{model}: {error_text}"
            )

            # Try the next available model.
            continue

    raise AnalysisError(
        "All available Gemini models failed. "
        + " | ".join(errors)
    )

def generate_json(
    prompt: str,
    language: str = "en",
    documents_hint: list[dict] | None = None,
) -> dict:
    """
    Run the analysis prompt and return a parsed JSON object.

    Provider:
    - stub   -> deterministic output
    - gemini -> Google GenAI with automatic model selection
    """
    documents_hint = documents_hint or []

    if settings.llm_provider == "stub":
        return _stub_analysis(language, documents_hint)

    if settings.llm_provider != "gemini":
        raise AnalysisError(
            f"Unknown LLM_PROVIDER: {settings.llm_provider}"
        )

    if not settings.gemini_api_key:
        raise AnalysisError(
            "GEMINI_API_KEY is not set — set it or use LLM_PROVIDER=stub"
        )

    text = _generate_with_gemini(prompt)

    return _extract_json(text)
