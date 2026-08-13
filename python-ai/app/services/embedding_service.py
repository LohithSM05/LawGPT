import threading

from sentence_transformers import SentenceTransformer

from ..core.config import settings

_model = None
_model_lock = threading.Lock()


def _get_model() -> SentenceTransformer:
    """Lazily load the embedding model once and cache it (a SentenceTransformer
    is heavy — several hundred MB in memory)."""
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                _model = SentenceTransformer(settings.embedding_model)
    return _model


def embed_texts(texts: list[str]) -> list[list[float]]:
    model = _get_model()
    embeddings = model.encode(texts, normalize_embeddings=True)
    return [emb.tolist() for emb in embeddings]


def embed_query(query: str) -> list[float]:
    return embed_texts([query])[0]
