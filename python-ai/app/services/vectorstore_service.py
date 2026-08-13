import chromadb

from ..core.config import settings

_client = None
_collection = None


def _get_collection():
    global _client, _collection
    if _collection is None:
        # anonymized_telemetry=False silences chromadb's opentelemetry attempt
        # (harmless, but its capture() signature is incompatible → noisy logs).
        _client = chromadb.PersistentClient(
            path=settings.chroma_persist_dir,
            settings=chromadb.Settings(anonymized_telemetry=False),
        )
        _collection = _client.get_or_create_collection(name=settings.chroma_collection)
    return _collection


def upsert_chunks(chunks: list[dict], embeddings: list[list[float]], meta: dict) -> None:
    """Upsert chunk records into the vector store. `meta` carries the stable
    document-level metadata; `chunks` must each have chunkIndex/pageNumber/text
    and `embeddings` aligned by index. Ids are <documentId>:<chunkIndex>, so
    reprocessing a document naturally replaces its own rows (delete + upsert
    are both idempotent, but we delete explicitly to also clear chunks that
    vanished between runs)."""
    collection = _get_collection()
    document_id = meta["documentId"]

    collection.upsert(
        ids=[f"{document_id}:{c['chunkIndex']}" for c in chunks],
        documents=[c["text"] for c in chunks],
        embeddings=embeddings,
        metadatas=[
            {
                "caseId": meta["caseId"],
                "documentId": document_id,
                "documentName": meta.get("documentName", ""),
                "docType": meta.get("docType", ""),
                "pageNumber": c["pageNumber"],
                "chunkIndex": c["chunkIndex"],
                "chunkCount": len(chunks),
            }
            for c in chunks
        ],
    )


def delete_document_chunks(document_id: str) -> None:
    collection = _get_collection()
    found = collection.get(where={"documentId": document_id}, include=[])
    if found["ids"]:
        collection.delete(ids=found["ids"])


def search(case_id: str, query_embedding: list[float], top_k: int) -> dict:
    """Case-scoped similarity search. Returns Chroma's raw query envelope;
    the route layer maps it to ChunkHit objects. Metadata (caseId, pageNumber,
    documentId) is how case scoping and page/document provenance survive the
    round-trip."""
    collection = _get_collection()
    return collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k,
        where={"caseId": case_id},
        include=["documents", "metadatas", "distances"],
    )
