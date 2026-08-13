from ..core.config import settings
from ..core.logging import logger
from .document_pipeline_service import search_document


class RetrievalError(Exception):
    """Raised only for hard failures the caller must know about. Optional
    grounding should usually swallow retrieval errors and fall back to full
    text instead."""


def retrieve_evidence(case_id: str, documents: list[dict], top_k: int | None = None) -> list[dict]:
    """English-only optional grounding: for each document, retrieve its most
    relevant chunks from the existing case-scoped Chroma index (the Module 4
    vector layer — unchanged, not rewritten here).

    Returns excerpts as ``{documentId, pageNumber, text}``. Retrieval never
    replaces the authoritative full page text; it is a supplementary grounding
    signal. Any retrieval failure degrades gracefully to an empty list — the
    analysis proceeds from full text. Kannada detection happens in the caller
    (analysis_service), which bypasses this entirely.
    """
    top_k = top_k or settings.analysis_top_k
    excerpts: list[dict] = []
    seen: set[tuple] = set()

    for doc in documents:
        query = _query_for_document(doc)
        if not query:
            continue
        try:
            hits = search_document(case_id=case_id, query=query, top_k=top_k)
        except Exception as exc:
            logger.warning("Retrieval skipped for analysis (case %s): %s", case_id, exc)
            continue

        for hit in hits:
            if hit.get("documentId") != doc.get("documentId"):
                continue  # case-scoped results can span documents; keep this doc's only
            key = (hit["documentId"], hit.get("pageNumber"), hit.get("chunkIndex"))
            if key in seen:
                continue
            seen.add(key)
            excerpts.append(
                {
                    "documentId": hit["documentId"],
                    "pageNumber": hit.get("pageNumber"),
                    "text": hit.get("text", ""),
                }
            )

    return excerpts


def _query_for_document(doc: dict) -> str:
    """A compact retrieval query for one document: its first page's opening
    text, which best represents the document's subject matter."""
    pages = doc.get("pages") or []
    if not pages:
        return ""
    return pages[0].get("text", "")[:500]


def format_retrieved_evidence(excerpts: list[dict], doc_index: dict[str, int]) -> str:
    """Render retrieved excerpts for the prompt, referencing documents by their
    [Document #N] index and page so the LLM can cite them with provenance."""
    if not excerpts:
        return ""
    lines = ["[Retrieved evidence excerpts (English retrieval grounding) — cite these with their source where used:]"]
    for ex in excerpts:
        idx = doc_index.get(ex["documentId"])
        label = f"Document #{idx}" if idx is not None else "Document #?"
        page = ex.get("pageNumber")
        page_label = f"page {page}" if page is not None else "page ?"
        lines.append(f"- ({label}, {page_label}): {ex['text'][:600]}")
    return "\n".join(lines)