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
