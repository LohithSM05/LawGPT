from typing import Literal

from pydantic import BaseModel, Field

from .schemas import Language, PageUnit


class AnalysisDocumentInput(BaseModel):
    """One document's authoritative page units as streamed by the backend
    (from the Module 4 DocumentPage provenance layer)."""

    documentId: str
    documentName: str = ""
    docType: str = ""
    pages: list[PageUnit] = []


class AnalysisRequest(BaseModel):
    caseId: str
    language: Language = "en"
    # True when the backend dropped whole later pages to fit the context budget.
    truncated: bool = False
    documents: list[AnalysisDocumentInput] = []


class AnalysisLaw(BaseModel):
    code: str  # IPC | BNS | BNSS | BSA | OTHER
    section: str
    label: str = ""
    description: str = ""
    relevance: str = ""
    # Curated cross-reference (e.g. "BNS 318(4)") — only ever from the curated
    # reference data; empty when the equivalence is explicitly unknown.
    equivalent: str = ""
    sourceDocumentId: str | None = None
    pageNumber: int | None = None


class AnalysisEntity(BaseModel):
    type: str  # person | organization | date | amount | place | vehicle | statute | other
    name: str
    mentions: int = 1
    sourceDocumentId: str | None = None
    pageNumber: int | None = None


class AnalysisTimelineItem(BaseModel):
    event: str
    date: str | None = None
    text: str = ""
    sourceDocumentId: str | None = None
    pageNumber: int | None = None


class AnalysisDocumentResult(BaseModel):
    documentId: str
    documentName: str = ""
    docType: str = ""
    summary: str = ""
    keyPoints: list[str] = []
    entities: list[AnalysisEntity] = []
    laws: list[AnalysisLaw] = []
    charCount: int = 0


class AnalysisResult(BaseModel):
    status: Literal["completed", "failed"] = "completed"
    language: Language = "en"
    retrievalUsed: bool = False
    summary: dict = Field(default_factory=lambda: {"text": "", "keyPoints": []})
    timeline: list[AnalysisTimelineItem] = []
    entities: list[AnalysisEntity] = []
    laws: list[AnalysisLaw] = []
    documents: list[AnalysisDocumentResult] = []
