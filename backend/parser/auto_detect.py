"""
Auto-detect whether a PDF is text-based or a scanned image.

Strategy:
  1. Open with pdfplumber and try to extract text from the first 2 pages.
  2. If we get more than MIN_CHARS characters, it is text-based.
  3. Otherwise treat it as scanned → use OCR fallback.
"""
import pdfplumber

MIN_CHARS = 100  # threshold: fewer chars means likely scanned


def is_text_based(pdf_path: str) -> bool:
    """Return True if the PDF has extractable text, False if it is scanned."""
    try:
        with pdfplumber.open(pdf_path) as pdf:
            sample_pages = pdf.pages[:2]  # check first two pages only
            text = " ".join(
                (page.extract_text() or "") for page in sample_pages
            )
        return len(text.strip()) >= MIN_CHARS
    except Exception:
        return False  # if pdfplumber can't even open it, treat as scanned
