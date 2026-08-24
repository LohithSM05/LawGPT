from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Service
    port: int = 8000
    backend_service_url: str = "http://localhost:5000"

    # Embeddings
    embedding_model: str = "BAAI/bge-small-en-v1.5"

    # Vector store (Chroma persistent client). Gitignored; regenerable from
    # MongoDB DocumentPage records if ever wiped.
    chroma_persist_dir: str = "./vectorstore"
    chroma_collection: str = "lawgpt_documents"

    # Module 5 Phase 3 — LLM provider for case analysis. "gemini" uses Google
    # Generative AI (GEMINI_API_KEY required); "stub" returns deterministic
    # canned output so tests can run without an API key. The model is kept
    # behind this flag on purpose: analysis never requires a live key, and the
    # stub path is what acceptance tests exercise.
    llm_provider: str = "gemini"
    gemini_api_key: str = ""
    gemini_model: str = ""

    # Analysis retrieval knob (English-only grounding). The embedding model
    # (BAAI/bge-small-en-v1.5) is English-oriented, so retrieval is ONLY used
    # as optional grounding for English corpora and is always bypassed when
    # Kannada script is detected in the case text.
    analysis_use_retrieval: bool = True
    analysis_top_k: int = 8

    # Pipeline knobs
    ocr_min_text_chars: int = 25
    ocr_raster_dpi: int = 200
    # Path to the Tesseract OCR binary. Many systems need this set explicitly
    # (e.g. a portable/side-installed tesseract); defaults to the PATH lookup.
    tesseract_cmd: str = "tesseract"
    # Tesseract OCR language(s): "eng" default; "kan" (or "kan+eng" for mixed
    # documents) for Kannada — requires the matching traineddata, installed on
    # Ubuntu via the "tesseract-ocr-kan" package (the language code is "kan").
    ocr_lang: str = "eng"
    chunk_size: int = 1000
    chunk_overlap: int = 150

    # CORS — the backend (and the frontend, when debugging the AI service
    # directly) are the only expected callers.
    cors_origins: list[str] = ["http://localhost:5000", "http://localhost:5173"]

    class Config:
        env_file = ".env"


settings = Settings()
