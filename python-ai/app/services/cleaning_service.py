import re
import unicodedata


def normalize_text(text: str) -> str:
    """Conservative text normalization for legal documents.

    Unifies line endings, drops control/format characters (but keeps newlines
    and tabs), removes zero-width marks and BOM, collapses runs of spaces and
    blank lines. Deliberately does NOT lowercase, stem, or strip punctuation —
    this is a faithful normalized copy of the source for chunking/embedding
    and downstream analysis, not a search-tokenizer. UTF-8 is preserved
    (including Kannada text — nothing Indic-specific is removed).
    """
    if not text:
        return ""

    text = text.replace("\r\n", "\n").replace("\r", "\n")

    # Drop zero-width / byte-order marks.
    text = re.sub(r"[\u200b\u200c\u200d\ufeff]", "", text)

    # NBSP and other space-like whitespace → regular space.
    text = text.replace("\xa0", " ").replace("\u3000", " ")

    # Remove control/format/surrogate/unassigned chars, but keep \n and \t
    # (both are Unicode category Cc).
    text = "".join(
        ch for ch in text if ch in "\n\t" or not unicodedata.category(ch).startswith("C")
    )

    # Collapse horizontal whitespace runs; trim trailing whitespace on lines.
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"[ \t]+$", "", text)

    # Collapse three-or-more blank lines down to one blank line.
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()
