import io
from pathlib import Path

import docx
import fitz  # PyMuPDF

from ..core.config import settings
from . import ocr_service
from .cleaning_service import normalize_text

IMAGE_EXTS = {".png", ".jpg", ".jpeg"}


class PipelineError(Exception):
    """Raised when a document yields no usable text (or is malformed)."""


def detect_format(filename: str, mime_type: str) -> str:
    ext = Path(filename or "").suffix.lower()
    mime = (mime_type or "").lower()

    if ext == ".pdf" or mime == "application/pdf":
        return "pdf"
    if ext == ".docx" or "wordprocessingml" in mime:
        return "docx"
    if ext == ".txt" or mime == "text/plain":
        return "txt"
    if ext in IMAGE_EXTS or mime.startswith("image/"):
        return "image"
    raise PipelineError(f"Unsupported format: {filename or 'unknown'} ({mime_type or 'no mime'})")


def extract_pages(fmt: str, data: bytes) -> list[dict]:
    """Returns ordered page-level text units [{pageNumber, text}].

    - pdf: per-page text layer via PyMuPDF, falling back to OCR when a page's
      extracted text is below the OCR threshold (scanned page).
    - docx / txt: a single page unit (pageNumber 1) — these formats have no
      intrinsic page concept.
    - image: a single page unit produced entirely by OCR.
    """
    if fmt == "pdf":
        return _extract_pdf_pages(data)
    if fmt == "docx":
        return _extract_docx(data)
    if fmt == "txt":
        return [{"pageNumber": 1, "text": normalize_text(data.decode("utf-8", errors="replace"))}]
    if fmt == "image":
        return [{"pageNumber": 1, "text": ocr_service.ocr_image_bytes(data)}]
    raise PipelineError(f"Unhandled format: {fmt}")


def _extract_pdf_pages(data: bytes) -> list[dict]:
    pages = []
    try:
        doc = fitz.open(stream=data, filetype="pdf")
    except Exception as exc:  # noqa: BLE001 — malformed/corrupt PDF
        raise PipelineError(f"Could not open PDF: {exc}") from exc

    for page in doc:
        text = normalize_text(page.get_text("text") or "")
        if len(text) < settings.ocr_min_text_chars:
            text = ocr_service.ocr_pdf_page(page, dpi=settings.ocr_raster_dpi)
        pages.append({"pageNumber": page.number + 1, "text": text})
    doc.close()
    return pages


def _extract_docx(data: bytes) -> list[dict]:
    try:
        document = docx.Document(io.BytesIO(data))
    except Exception as exc:  # noqa: BLE001
        raise PipelineError(f"Could not open DOCX: {exc}") from exc
    parts = [p.text for p in document.paragraphs if p.text.strip()]
    return [{"pageNumber": 1, "text": normalize_text("\n\n".join(parts))}]
