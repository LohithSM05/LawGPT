from typing import Literal

from pydantic import BaseModel, Field

Language = Literal["en", "kn"]


class PageUnit(BaseModel):
    pageNumber: int
    text: str
    charCount: int


class ProcessResult(BaseModel):
    format: str
    pageCount: int
    chunkCount: int
    charCount: int
    pages: list[PageUnit]


class SearchRequest(BaseModel):
    caseId: str
    query: str
    topK: int = Field(default=5, ge=1, le=50)
    language: Language = "en"


class ChunkHit(BaseModel):
    documentId: str
    documentName: str
    docType: str = ""
    pageNumber: int
    chunkIndex: int
    chunkCount: int
    text: str
    score: float


class SearchResult(BaseModel):
    query: str
    chunks: list[ChunkHit]
