from fastapi import APIRouter, HTTPException

from ...models.analysis_schemas import AnalysisRequest, AnalysisResult
from ...services.analysis_service import analyze_case
from ...services.llm_service import AnalysisError

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.post("/case", response_model=AnalysisResult, summary="Structured analysis of a case's processed documents")
def analyze_case_route(req: AnalysisRequest):
    """Module 5 Phase 3 — the legal-document analysis layer.

    Stateless per request: the backend streams the case's authoritative page
    units (from MongoDB DocumentPage) here; this service never touches MongoDB
    or the uploads filesystem. Kannada text (detected by Unicode block) bypasses
    the English-only retrieval grounding; `language` selects the narrative
    output language ('en' | 'kn')."""
    try:
        result = analyze_case(
            case_id=req.caseId,
            language=req.language,
            truncated=req.truncated,
            documents=req.documents,
        )
        return AnalysisResult.model_validate(result)
    except AnalysisError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
