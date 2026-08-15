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
        "\"text\": <short supporting text>, \"sourceDocument\": <#N>, \"pageNumber\": <page> } ] — "
        "chronology of factual events. Use sourceDocument and pageNumber only when the "
        "fact can be grounded in that document/page. Never invent a page number.\n"
        "- \"entities\": [ { \"type\": <one of person|organization|date|amount|place|vehicle|statute|other>, "
        "\"name\": <as written>, \"mentions\": <count>, \"sourceDocument\": <#N>, "
        "\"pageNumber\": <page> } ] — identify important entities. "
        "If the same entity appears in multiple documents, treat it as one case-level entity "
        "and use its most relevant source.\n"
        "- \"laws\": [ { \"code\": <IPC|BNS|BNSS|BSA|OTHER>, \"section\": <as stated>, "
        "\"label\": <short label>, \"description\": <short>, \"relevance\": <why it applies>, "
        "\"sourceDocument\": <#N>, \"pageNumber\": <page> } ] — applicable statutes mentioned "
        "or clearly relevant based strictly on the documents. Do not invent sections.\n"
        "- \"documents\": [ { \"sourceDocument\": <#N>, \"summary\": <that document's own summary>, "
        "\"keyPoints\": [<3-6 short key points specific to that document>] } ] — "
        "IMPORTANT: You MUST provide exactly ONE entry for EVERY document above, even if "
        "documents contain repeated or overlapping information. Each summary must describe "
        "that particular document, not the entire case.\n"
        "\nIMPORTANT RULES:\n"
        "1. Analyze ALL supplied documents together.\n"
        "2. Repeated information across documents must not be blindly duplicated in the "
        "case-level timeline, entities, or laws.\n"
        "3. Keep document-specific information in the documents array.\n"
        "4. Never invent facts, dates, page numbers, people, organizations, or laws.\n"
        "5. sourceDocument refers to the [Document #N] identifier above.\n"
        "6. pageNumber must be one of the actual page numbers supplied for that document; "
        "otherwise use null.\n"
        "7. If two documents describe the same event, combine it at case level when appropriate "
        "while retaining the relevant document-specific analysis.\n"
        f"\nWrite all narrative text (summaries, labels, descriptions, relevance) in "
        f"{_LANGUAGE_NAMES.get(language, 'English')}."
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

        if not law.section:
            continue

        # Deduplicate identical law references at case level.
        # Document-specific provenance is still retained in the first
        # occurrence and the individual document analysis remains available.
        duplicate = next(
            (
                existing
                for existing in laws
                if existing.code == law.code
                and existing.section.lower().strip() == law.section.lower().strip()
            ),
            None,
        )

        if duplicate is None:
            laws.append(law)

    # Per-document breakdown.
    # Gemini is asked to return one entry for every document. However, the
    # backend must not depend on the model remembering this requirement.
    # Therefore every supplied document gets a result here, even if Gemini
    # accidentally omits an entry.
    raw_documents = raw.get("documents") or []

    raw_doc_by_number: dict[int, dict] = {}

    for raw_doc in raw_documents:
        try:
            source_number = int(raw_doc.get("sourceDocument"))
        except (TypeError, ValueError):
            continue

        if 1 <= source_number <= len(documents):
            raw_doc_by_number[source_number] = raw_doc

    doc_results: list[AnalysisDocumentResult] = []

    for index, doc in enumerate(documents, start=1):
        raw_doc = raw_doc_by_number.get(index, {})

        # Only use the LLM's document-specific summary when it actually
        # supplied one. Never fabricate a legal summary in the backend.
        document_summary = str(
            raw_doc.get("summary") or ""
        ).strip()

        document_key_points = [
            str(k).strip()
            for k in (raw_doc.get("keyPoints") or [])
            if str(k).strip()
        ]

        document_entities = [
            e for e in entities
            if e.sourceDocumentId == doc.documentId
        ]

        document_laws = [
            law for law in laws
            if law.sourceDocumentId == doc.documentId
        ]

        doc_results.append(
            AnalysisDocumentResult(
                documentId=doc.documentId,
                documentName=doc.documentName,
                docType=doc.docType,
                summary=document_summary,
                keyPoints=document_key_points,
                entities=document_entities,
                laws=document_laws,
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

def _fill_missing_document_analysis(
    raw: dict,
    documents: list[AnalysisDocumentInput],
    language: str,
) -> dict:
    """
    Fill missing per-document summaries/key points with focused Gemini calls.

    The main case analysis remains authoritative for the case-level summary,
    timeline, entities and laws. This fallback only asks Gemini for document-
    specific analysis when the main response omitted it.
    """
    raw_documents = raw.get("documents") or []

    existing_by_number: dict[int, dict] = {}

    for item in raw_documents:
        try:
            source_number = int(item.get("sourceDocument"))
        except (TypeError, ValueError):
            continue

        if 1 <= source_number <= len(documents):
            existing_by_number[source_number] = item

    for index, doc in enumerate(documents, start=1):
        existing = existing_by_number.get(index, {})

        existing_summary = str(existing.get("summary") or "").strip()
        existing_key_points = [
            str(point).strip()
            for point in (existing.get("keyPoints") or [])
            if str(point).strip()
        ]

        # Gemini already supplied useful document-level analysis.
        if existing_summary and existing_key_points:
            continue

        page_text = "\n".join(
            f"(page {page.pageNumber}): {page.text}"
            for page in doc.pages
        )

        prompt = f"""
You are a neutral legal document analyst.

Analyze ONLY the following document.

Document name: {doc.documentName}
Document type: {doc.docType or "unknown"}

Document text:
{page_text}

Return ONLY valid JSON with exactly these keys:

{{
  "sourceDocument": {index},
  "summary": "A concise, neutral summary of this particular document.",
  "keyPoints": [
    "3-6 factual key points specific to this document."
  ]
}}

Rules:
1. Describe ONLY what this document states.
2. Do not summarize the entire case.
3. Do not invent facts, dates, people, amounts, laws, or events.
4. Keep the summary concise and factual.
5. Write all narrative text in {"Kannada" if language == "kn" else "English"}.
6. The sourceDocument value MUST be {index}.
"""

        try:
            logger.info(
                "Generating focused per-document analysis for document %s: %s",
                index,
                doc.documentName,
            )

            fallback_raw = generate_json(
                prompt,
                language=language,
                documents_hint=[_hint(doc)],
            )

            fallback_documents = fallback_raw.get("documents") or []

            fallback_item = None

            # The focused fallback prompt returns one document object
            # directly, not inside a "documents" array.
            if (
                isinstance(fallback_raw, dict)
                and (
                    fallback_raw.get("summary")
                    or fallback_raw.get("keyPoints")
                )
            ):
                fallback_item = fallback_raw
            else:
                fallback_documents = fallback_raw.get("documents") or []
                fallback_item = None

                for item in fallback_documents:
                    try:
                        source_number = int(item.get("sourceDocument"))
                    except (TypeError, ValueError):
                        continue

                    if source_number == index:
                        fallback_item = item
                        break

                if fallback_item is None and fallback_documents:
                    fallback_item = fallback_documents[0]

            if fallback_item:
                existing_by_number[index] = {
                    "sourceDocument": index,
                    "summary": str(
                        fallback_item.get("summary") or ""
                    ).strip(),
                    "keyPoints": [
                        str(point).strip()
                        for point in (fallback_item.get("keyPoints") or [])
                        if str(point).strip()
                    ],
                }

        except Exception as exc:
            # Do not fail the entire case analysis just because a focused
            # document-level fallback failed.
            logger.warning(
                "Per-document analysis fallback failed for document %s (%s): %s",
                index,
                doc.documentName,
                exc,
            )

    raw["documents"] = [
        existing_by_number[index]
        for index in range(1, len(documents) + 1)
        if index in existing_by_number
    ]

    return raw

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

    raw = generate_json(
        prompt,
        language=language,
        documents_hint=[_hint(d) for d in documents],
    )

    raw = _fill_missing_document_analysis(
        raw,
        documents,
        language,
    )

    return _normalize(
        raw,
        documents,
        language,
        retrieval_used,
    ).model_dump()
