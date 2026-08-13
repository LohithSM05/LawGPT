from ..core.config import settings
from ..core.logging import logger
from ..models.analysis_schemas import (
    AnalysisDocumentInput,
    AnalysisDocumentResult,
    AnalysisEntity,
    AnalysisLaw,
    AnalysisResult,
    AnalysisTimelineItem,
)
from ..nlp.ipc_bns_map import normalize_law
from . import rag_service
from .llm_service import AnalysisError, generate_json

_LANGUAGE_NAMES = {"en": "English", "kn": "Kannada (ಕನ್ನಡ)"}

# Entity types we ask the LLM to produce (free-form strings are also accepted,
# but these are the canonical set).
_ENTITY_TYPES = (
    "person",
    "organization",
    "date",
    "amount",
    "place",
    "vehicle",
    "statute",
    "other",
)


def _contains_kannada(text: str) -> bool:
    """Detect Kannada script by the Unicode block U+0C80–U+0CFF (per the phase
    constraints — deterministic, no model involved)."""
    return any(0x0C80 <= ord(ch) <= 0x0CFF for ch in text)


def _hint(doc: AnalysisDocumentInput) -> dict:
    """Compact dict form of a document (also consumed by the stub LLM)."""
    return {
        "documentId": doc.documentId,
        "documentName": doc.documentName,
        "docType": doc.docType,
        "pages": [{"pageNumber": p.pageNumber, "text": p.text} for p in doc.pages],
    }


def _canonical_code(raw: str) -> str:
    token = (raw or "").upper().replace(" ", "").replace(".", "").replace("-", "")
    if token in ("IPC", "INDIANPENALCODE"):
        return "IPC"
    if token in ("BNS", "BHARATIYANYAYASANHITA", "BHARATIYANYA"):
        return "BNS"
    if token in ("BNSS", "BHARATIYANAGARIKSURAKSHASANHITA"):
        return "BNSS"
    if token in ("BSA", "BHARATIYASAKSHYAADHINIYAM"):
        return "BSA"
    return "OTHER"


def _build_prompt(
    documents: list[AnalysisDocumentInput],
    language: str,
    truncated: bool,
    retrieval_note: str,
) -> str:
    lines: list[str] = []
    lines.append(
        "You are a neutral legal document analyst. Analyze the following case documents "
        "and produce structured JSON. Be strictly factual — only state what the documents "
        "actually say. Never invent events, entities, dates, or statute sections."
    )
    lines.append("Documents are labelled [Document #N: name (docType)] and pages as (page <number>).")
    if truncated:
        lines.append(
            "NOTE: this input was truncated for length — some later pages were excluded. "
            "Do not mention the excluded pages."
        )
    if retrieval_note:
        lines.append(retrieval_note)

    for i, doc in enumerate(documents, start=1):
        lines.append(f"\n[Document #{i}: {doc.documentName} ({doc.docType or 'unknown'})]")
        for page in doc.pages:
            lines.append(f"(page {page.pageNumber}): {page.text}")

    lines.append(
        "\nRespond with ONLY a JSON object (no markdown, no commentary) with exactly these keys:\n"
        "- \"summary\": { \"text\": <neutral case summary>, \"keyPoints\": [<3-6 short key points>] }\n"
        "- \"timeline\": [ { \"event\": <short event>, \"date\": <date as stated, or null>, "
        "\"text\": <short supporting quote>, \"sourceDocument\": <#N>, \"pageNumber\": <page> } ] — "
        "a chronology of facts/events stated in the documents; sourceDocument/pageNumber cite "
        "the exact page each fact comes from, or null if unknown\n"
        "- \"entities\": [ { \"type\": <one of person|organization|date|amount|place|vehicle|statute|other>, "
        "\"name\": <as written>, \"mentions\": <count>, \"sourceDocument\": <#N>, \"pageNumber\": <page> } ]\n"
        "- \"laws\": [ { \"code\": <IPC|BNS|BNSS|BSA|OTHER>, \"section\": <as stated>, "
        "\"label\": <short label>, \"description\": <short>, \"relevance\": <why it applies>, "
        "\"sourceDocument\": <#N>, \"pageNumber\": <page> } ] — applicable statutes mentioned in the "
        "documents; cite the page where each was mentioned\n"
        "- \"documents\": [ { \"sourceDocument\": <#N>, \"summary\": <that document's summary>, "
        "\"keyPoints\": [<short key points for that document>] } ] for every [Document #N] above\n"
        f"\nWrite all narrative text (summaries, labels) in {_LANGUAGE_NAMES.get(language, 'English')}."
    )
    return "\n".join(lines)


def _resolve_document(documents: list[AnalysisDocumentInput], raw_idx) -> AnalysisDocumentInput | None:
    try:
        idx = int(raw_idx)
    except (TypeError, ValueError):
        return None
    if 1 <= idx <= len(documents):
        return documents[idx - 1]
    return None


def _validated_page(doc: AnalysisDocumentInput | None, raw_page) -> int | None:
    """Only accept a page the LLM could actually have seen (one of the provided
    page numbers for that document). Anything else is a hallucinated citation →
    null, never kept."""
    if doc is None or raw_page is None:
        return None
    try:
        page = int(raw_page)
    except (TypeError, ValueError):
        return None
    provided = {p.pageNumber for p in doc.pages}
    return page if page in provided else None


def _normalize_law(raw: dict, documents: list[AnalysisDocumentInput]) -> AnalysisLaw:
    doc = _resolve_document(documents, raw.get("sourceDocument"))
    section = str(raw.get("section") or "").strip()
    code = _canonical_code(raw.get("code"))
    label = str(raw.get("label") or "")
    curated = normalize_law(code, section, fallback_label=label)
    return AnalysisLaw(
        code=code,
        section=section,
        label=curated["label"] or label,
        description=str(raw.get("description") or ""),
        relevance=str(raw.get("relevance") or ""),
        equivalent=curated["equivalent"],
        sourceDocumentId=doc.documentId if doc else None,
        pageNumber=_validated_page(doc, raw.get("pageNumber")),
    )


def _normalize(raw: dict, documents: list[AnalysisDocumentInput], language: str, retrieval_used: bool) -> AnalysisResult:
    summary_raw = raw.get("summary") or {}
    summary = {
        "text": str(summary_raw.get("text") or ""),
        "keyPoints": [str(k) for k in (summary_raw.get("keyPoints") or [])],
    }

    timeline: list[AnalysisTimelineItem] = []
    for item in raw.get("timeline") or []:
        doc = _resolve_document(documents, item.get("sourceDocument"))
        timeline.append(
            AnalysisTimelineItem(
                event=str(item.get("event") or "").strip(),
                date=str(item.get("date")) if item.get("date") is not None else None,
                text=str(item.get("text") or ""),
                sourceDocumentId=doc.documentId if doc else None,
                pageNumber=_validated_page(doc, item.get("pageNumber")),
            )
        )

    entities: list[AnalysisEntity] = []
    for item in raw.get("entities") or []:
        doc = _resolve_document(documents, item.get("sourceDocument"))
        etype = str(item.get("type") or "other").strip().lower()
        if etype not in _ENTITY_TYPES:
            etype = "other"
        entities.append(
            AnalysisEntity(
                type=etype,
                name=str(item.get("name") or "").strip(),
                mentions=max(int(item.get("mentions") or 1), 1),
                sourceDocumentId=doc.documentId if doc else None,
                pageNumber=_validated_page(doc, item.get("pageNumber")),
            )
        )

    laws: list[AnalysisLaw] = []
    for item in raw.get("laws") or []:
        law = _normalize_law(item, documents)
        if law.section:
            laws.append(law)

    # Per-document breakdown: summaries come from the LLM's per-document block;
    # entities/laws are derived from the case-level lists by sourceDocumentId so
    # provenance stays consistent between the two views.
    by_id = {d.documentId: d for d in documents}
    doc_results: list[AnalysisDocumentResult] = []
    for raw_doc in raw.get("documents") or []:
        doc = _resolve_document(documents, raw_doc.get("sourceDocument"))
        if doc is None:
            continue
        did = doc.documentId
        doc_results.append(
            AnalysisDocumentResult(
                documentId=did,
                documentName=doc.documentName,
                docType=doc.docType,
                summary=str(raw_doc.get("summary") or ""),
                keyPoints=[str(k) for k in (raw_doc.get("keyPoints") or [])],
                entities=[e for e in entities if e.sourceDocumentId == did],
                laws=[l for l in laws if l.sourceDocumentId == did],
                charCount=sum(len(p.text) for p in doc.pages),
            )
        )

    return AnalysisResult(
        status="completed",
        language=language,
        retrievalUsed=retrieval_used,
        summary=summary,
        timeline=timeline,
        entities=entities,
        laws=laws,
        documents=doc_results,
    )


def analyze_case(case_id: str, language: str, truncated: bool, documents: list[AnalysisDocumentInput]) -> dict:
    """Run one case analysis.

    Kannada handling: if Kannada script is detected anywhere in the case text,
    English-only Chroma retrieval is bypassed entirely (bge-small-en-v1.5 does
    not embed Kannada meaningfully) and the analysis uses the authoritative
    full page text. English corpora may use retrieval as optional grounding.
    """
    if not documents:
        raise AnalysisError("No documents provided for analysis")

    has_kannada = any(_contains_kannada(page.text) for doc in documents for page in doc.pages)
    retrieval_used = False
    excerpts: list[dict] = []

    if not has_kannada and settings.analysis_use_retrieval:
        excerpts = rag_service.retrieve_evidence(case_id, [_hint(d) for d in documents])
        retrieval_used = bool(excerpts)
    logger.info(
        "Analyzing case %s (docs=%d, kannada=%s, retrieval=%s, language=%s)",
        case_id,
        len(documents),
        has_kannada,
        retrieval_used,
        language,
    )

    doc_index = {d.documentId: i for i, d in enumerate(documents, start=1)}
    retrieval_note = rag_service.format_retrieved_evidence(excerpts, doc_index)
    prompt = _build_prompt(documents, language, truncated, retrieval_note)

    raw = generate_json(prompt, language=language, documents_hint=[_hint(d) for d in documents])
    return _normalize(raw, documents, language, retrieval_used).model_dump()
