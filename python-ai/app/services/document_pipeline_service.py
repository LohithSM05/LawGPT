from ..core.config import settings
from ..core.logging import logger
from . import chunking_service, embedding_service, extraction_service, vectorstore_service
from .cleaning_service import normalize_text
from .extraction_service import PipelineError

__all__ = ["PipelineError", "process_document", "search_document"]


def process_document(
    data: bytes,
    filename: str,
    mime_type: str,
    document_id: str,
    case_id: str,
    doc_type: str = "",
    original_name: str = "",
) -> dict:
    """Run the full Phase 2 pipeline for one uploaded document:

    format detection → extraction (PDF text layer / DOCX / TXT, OCR fallback
    for scanned pages and images) → cleaning/normalization → ordered page-level
    text units → page-aware chunking → embeddings → ChromaDB upsert.

    Returns the structured result the backend persists into MongoDB
    (DocumentPage rows + Document.extractedText/pageCount/chunkCount).
    """
    fmt = extraction_service.detect_format(filename, mime_type)
    logger.info("Processing document %s (format=%s, case=%s)", document_id, fmt, case_id)

    raw_pages = extraction_service.extract_pages(fmt, data)

    # Skip pages with no usable text (e.g. OCR returned nothing) — but keep
    # the original pageNumber for provenance.
    pages = [
        {"pageNumber": p["pageNumber"], "text": normalize_text(p["text"])}
        for p in raw_pages
        if p["text"].strip()
    ]
    if not pages:
        raise PipelineError("No text could be extracted from this document")

    chunks = chunking_service.chunk_pages(pages)
    if not chunks:
        raise PipelineError("No text chunks could be created from this document")

    logger.info("Document %s: %d pages, %d chunks — embedding", document_id, len(pages), len(chunks))
    embeddings = embedding_service.embed_texts([c["text"] for c in chunks])

    # Idempotent reprocessing: clear any prior chunks for this document first,
    # then upsert the new ones.
    vectorstore_service.delete_document_chunks(document_id)
    vectorstore_service.upsert_chunks(
        chunks,
        embeddings,
        {
            "caseId": case_id,
            "documentId": document_id,
            "documentName": original_name or filename,
            "docType": doc_type,
        },
    )

    return {
        "format": fmt,
        "pageCount": len(pages),
        "chunkCount": len(chunks),
        "charCount": sum(len(p["text"]) for p in pages),
        "pages": [
            {"pageNumber": p["pageNumber"], "text": p["text"], "charCount": len(p["text"])}
            for p in pages
        ],
    }


def search_document(case_id: str, query: str, top_k: int) -> list[dict]:
    """Case-scoped retrieval from the vector store. Returns ChunkHit-shaped
    dicts sorted by ascending distance (closest first)."""
    query_embedding = embedding_service.embed_query(query)
    raw = vectorstore_service.search(case_id, query_embedding, top_k)

    ids = raw.get("ids", [[]])[0]
    documents = raw.get("documents", [[]])[0]
    metadatas = raw.get("metadatas", [[]])[0]
    distances = raw.get("distances", [[]])[0]

    hits = []
    for i in range(len(ids)):
        meta = metadatas[i]
        hits.append(
            {
                "documentId": meta.get("documentId", ""),
                "documentName": meta.get("documentName", ""),
                "docType": meta.get("docType", ""),
                "pageNumber": int(meta.get("pageNumber", 0)),
                "chunkIndex": int(meta.get("chunkIndex", 0)),
                "chunkCount": int(meta.get("chunkCount", 0)),
                "text": documents[i],
                "score": float(distances[i]),
            }
        )
    hits.sort(key=lambda h: h["score"])
    return hits
