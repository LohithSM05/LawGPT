import io

import pytesseract
from PIL import Image

from ..core.config import settings
from .cleaning_service import normalize_text

# Tesseract is a system binary, not a Python package — pytesseract shells out
# to it. The location is configurable via TESSERACT_CMD / settings because
# many setups (including portable installs) don't have it on PATH.
pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd


def ocr_image_bytes(data: bytes) -> str:
    """OCR a raw image (PNG/JPG/...) into normalized text."""
    image = Image.open(io.BytesIO(data))
    return normalize_text(pytesseract.image_to_string(image, lang=settings.ocr_lang))


def ocr_pdf_page(page, dpi: int = 200) -> str:
    """OCR a single PyMuPDF page by rasterizing it and running Tesseract.

    Used as the per-page fallback when a PDF page has no (or too little)
    extractable text layer — i.e. scanned documents.
    """
    pix = page.get_pixmap(dpi=dpi)
    image = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    return normalize_text(pytesseract.image_to_string(image, lang=settings.ocr_lang))
