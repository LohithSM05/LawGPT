from langchain_text_splitters import RecursiveCharacterTextSplitter

from ..core.config import settings


def chunk_pages(pages: list[dict]) -> list[dict]:
    """Page-aware chunking: a chunk never crosses a page boundary.

    The recursive character splitter runs independently on each page's text,
    so a chunk's provenance (pageNumber) is always a single, real source page.
    Chunk index is global across the whole document so Chroma ids are stable
    and unique. Pages with empty text produce no chunks.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
        separators=["\n\n", "\n", " ", ""],
    )

    chunks = []
    index = 0
    for page in pages:
        text = page["text"]
        if not text:
            continue
        for part in splitter.split_text(text):
            chunk_text = part.strip()
            if not chunk_text:
                continue
            chunks.append(
                {
                    "chunkIndex": index,
                    "pageNumber": page["pageNumber"],
                    "text": chunk_text,
                }
            )
            index += 1
    return chunks
