from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from ...models.schemas import SearchRequest, SearchResult
from ...services.document_pipeline_service import PipelineError, process_document, search_document

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/process", summary="Full extraction → OCR → chunk → embed → store pipeline")
async def process_document_route(
    file: UploadFile = File(...),
    document_id: str = Form(...),
    case_id: str = Form(...),
    doc_type: str = Form(""),
    original_name: str = Form(""),
    mime_type: str = Form(""),
    language: str = Form("en"),
):
    """Process a single uploaded case document. Called only by the backend
    (which enforces case access control); this service is stateless — it never
    touches MongoDB or the uploads filesystem."""
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")

    effective_mime = mime_type or file.content_type or ""
    try:
        result = process_document(
            data=data,
            filename=file.filename or original_name,
            mime_type=effective_mime,
            document_id=document_id,
            case_id=case_id,
            doc_type=doc_type,
            original_name=original_name,
        )
    except PipelineError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return {"success": True, "data": result}


@router.post("/search", response_model=SearchResult, summary="Case-scoped similarity search")
def search_route(req: SearchRequest):
    """Retrieval infrastructure for Modules 5/6 — NOT Module 5 analysis. Queries
    only chunks whose metadata caseId matches, so results never leak across
    cases."""
    hits = search_document(case_id=req.caseId, query=req.query, top_k=req.topK)
    return SearchResult(query=req.query, chunks=hits)
