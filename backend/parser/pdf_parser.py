"""
pdf_parser.py — Extract transactions from bank statement PDFs and images.

Supports:
  - ICICI Bank 'Detailed Statement' (multi-page table PDF)
  - Generic text-based PDFs (line regex fallback)
  - Scanned PDFs and images (Tesseract OCR)

Date formats handled:
  26/Mar/2026  (ICICI Bank month-name format)
  26/03/2026   (standard DD/MM/YYYY)
  26-03-2026   (standard DD-MM-YYYY)
"""

import re
from datetime import datetime

import pdfplumber

from parser.auto_detect import is_text_based

# ---------------------------------------------------------------------------
# Date helpers
# ---------------------------------------------------------------------------
MONTH_MAP = {
    'jan':'01','feb':'02','mar':'03','apr':'04','may':'05','jun':'06',
    'jul':'07','aug':'08','sep':'09','oct':'10','nov':'11','dec':'12',
}


def _parse_date(raw) -> str:
    if not raw:
        return ''
    raw = re.sub(r'\s+', '', str(raw)).strip()

    # 26/Mar/2026 or 26-Mar-2026 (ICICI Bank)
    m = re.match(r'(\d{1,2})[/\-]([A-Za-z]{3})[/\-](\d{2,4})$', raw)
    if m:
        day, mon, year = m.groups()
        year = '20' + year if len(year) == 2 else year
        return f"{year}-{MONTH_MAP.get(mon.lower(),'01')}-{day.zfill(2)}"

    for fmt in ('%d/%m/%Y', '%d-%m-%Y', '%d/%m/%y', '%d-%m-%y'):
        try:
            return datetime.strptime(raw, fmt).strftime('%Y-%m-%d')
        except ValueError:
            continue
    return raw


def _parse_amount(raw) -> float | None:
    if raw is None:
        return None
    text = re.sub(r'\s+', '', str(raw)).replace(',', '')
    if text in ('', '-', 'NA', 'nil', 'Nil', 'None'):
        return None
    try:
        return float(text)
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# ICICI Bank table extraction
# ---------------------------------------------------------------------------
_ICICI_COL_PATTERNS = {
    'transaction date': 'date',
    'value date':       'value_date',
    'transaction remarks': 'description',
    'transaction\nremarks': 'description',
    'withdrawal':       'debit',
    'withdra':          'debit',
    'deposit':          'credit',
    'balance':          'balance',
}


def _identify_columns(header_row: list) -> dict:
    """Map column index to field name from a header row."""
    mapping = {}
    for idx, cell in enumerate(header_row):
        if cell is None:
            continue
        key = str(cell).strip().lower()
        for pattern, field in _ICICI_COL_PATTERNS.items():
            if pattern in key:
                # Prefer 'transaction date' over 'value date' for 'date'
                if field == 'value_date' and 'date' in mapping:
                    continue
                if field == 'date' and 'date' in mapping:
                    mapping['date'] = idx  # overwrite with better match
                elif field not in mapping:
                    mapping[field] = idx
                break
    # Promote value_date to date if no transaction date found
    if 'date' not in mapping and 'value_date' in mapping:
        mapping['date'] = mapping.pop('value_date')
    return mapping


def _is_header_row(row: list) -> bool:
    """Check if this row contains column headers."""
    if not row:
        return False
    joined = ' '.join(str(c or '').lower() for c in row)
    return 'transaction' in joined and ('balance' in joined or 'deposit' in joined)


def _is_skip_row(row: list) -> bool:
    """Skip footer, summary, and empty rows."""
    if not row:
        return True
    if all(c is None or str(c).strip() == '' for c in row):
        return True
    first = str(row[0] or '').strip().lower()
    return any(kw in first for kw in ('page', 'opening', 'closing', 'total', 'legend', 'end of'))


def _row_to_txn(row: list, col_map: dict, account_id: str, source_pdf: str) -> dict | None:
    """Convert a table row to a transaction dict using the column mapping."""
    def _get(field):
        idx = col_map.get(field)
        if idx is None or idx >= len(row):
            return None
        return row[idx]

    date    = _parse_date(_get('date'))
    balance = _parse_amount(_get('balance'))

    if not date or balance is None:
        return None

    desc = re.sub(r'\s+', ' ', str(_get('description') or '')).strip()

    return {
        'account_id':  account_id,
        'date':        date,
        'description': desc,
        'debit':       _parse_amount(_get('debit')),
        'credit':      _parse_amount(_get('credit')),
        'balance':     balance,
        'source_pdf':  source_pdf,
    }


def _extract_icici_tables(pdf_path: str, account_id: str, source_pdf: str) -> list[dict]:
    """
    Extract transactions from all pages of an ICICI Bank statement.

    Key fix: once a column mapping is found on page 1, it is REUSED on
    subsequent pages that have data rows but no header row (continuation pages).
    This fixes the missing-transactions-on-page-2 bug.
    """
    transactions = []
    last_col_map = {}   # carries mapping across pages

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                if not table or len(table) < 2:
                    continue

                col_map = {}
                data_start = 0

                # Scan each row to find the header
                for i, row in enumerate(table):
                    if _is_header_row(row):
                        col_map = _identify_columns(row)
                        data_start = i + 1
                        break

                # If no header found on this page but we have one from earlier, reuse it
                if not col_map and last_col_map:
                    col_map = last_col_map
                    data_start = 0

                # Skip if we still have no mapping and the table doesn't look transactional
                if not col_map or 'balance' not in col_map:
                    continue

                # Save mapping for continuation pages
                last_col_map = col_map

                for row in table[data_start:]:
                    if _is_skip_row(row):
                        continue
                    txn = _row_to_txn(row, col_map, account_id, source_pdf)
                    if txn:
                        transactions.append(txn)

    return transactions


# ---------------------------------------------------------------------------
# Generic line-regex extraction (fallback for flat-text PDFs)
# ---------------------------------------------------------------------------
TXN_RE = re.compile(
    r'(\d{1,2}[\/\-][A-Za-z]{3}[\/\-]\d{2,4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})'
    r'\s{1,10}(.+?)\s{2,}'
    r'([\d,]+\.\d{2})?\s*([\d,]+\.\d{2})?\s{1,10}([\d,]+\.\d{2})'
)


def _extract_from_text_lines(pdf_path: str, account_id: str, source_pdf: str) -> list[dict]:
    lines = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                lines.extend(text.splitlines())

    transactions = []
    for line in lines:
        line = line.strip()
        m = TXN_RE.search(line)
        if not m:
            continue
        date_raw, desc, debit_raw, credit_raw, balance_raw = m.groups()
        if any(kw in desc.lower() for kw in ('date', 'balance', 'description')):
            continue
        transactions.append({
            'account_id':  account_id,
            'date':        _parse_date(date_raw),
            'description': desc.strip(),
            'debit':       _parse_amount(debit_raw),
            'credit':      _parse_amount(credit_raw),
            'balance':     _parse_amount(balance_raw),
            'source_pdf':  source_pdf,
        })
    return transactions


# ---------------------------------------------------------------------------
# OCR — for scanned PDFs or image files
# ---------------------------------------------------------------------------
def _ocr_lines_from_pdf(pdf_path: str) -> list[str]:
    """Convert each PDF page to image and OCR it."""
    import pytesseract
    lines = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            pil_image = page.to_image(resolution=300).original
            lines.extend(pytesseract.image_to_string(pil_image, lang='eng').splitlines())
    return lines


def _ocr_lines_from_image(image_path: str) -> list[str]:
    """OCR a plain image file (JPG/PNG/etc.)."""
    import pytesseract
    from PIL import Image
    img = Image.open(image_path)
    return pytesseract.image_to_string(img, lang='eng').splitlines()


def _extract_from_ocr_lines(lines: list[str], account_id: str, source_pdf: str) -> list[dict]:
    transactions = []
    for line in lines:
        line = line.strip()
        m = TXN_RE.search(line)
        if not m:
            continue
        date_raw, desc, debit_raw, credit_raw, balance_raw = m.groups()
        transactions.append({
            'account_id':  account_id,
            'date':        _parse_date(date_raw),
            'description': desc.strip(),
            'debit':       _parse_amount(debit_raw),
            'credit':      _parse_amount(credit_raw),
            'balance':     _parse_amount(balance_raw),
            'source_pdf':  source_pdf,
        })
    return transactions


# ---------------------------------------------------------------------------
# Image file extraction (JPG / PNG / WEBP etc.)
# ---------------------------------------------------------------------------
IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff', '.tif'}


def is_image_file(path: str) -> bool:
    import os
    return os.path.splitext(path)[1].lower() in IMAGE_EXTENSIONS


def extract_from_image(image_path: str, account_id: str, source_file: str) -> dict:
    """
    Extract transactions from a plain image (JPG/PNG bank statement screenshot).
    Uses Tesseract OCR on the image directly.
    """
    try:
        lines = _ocr_lines_from_image(image_path)
        txns = _extract_from_ocr_lines(lines, account_id, source_file)
        return {'_meta_pdf_type': 'image (OCR)', 'transactions': txns}
    except ImportError:
        return {'_meta_pdf_type': 'image (OCR unavailable)', 'transactions': []}


# ---------------------------------------------------------------------------
# Main public entry point
# ---------------------------------------------------------------------------
def extract_transactions(file_path: str, account_id: str, source_file: str) -> dict:
    """
    Auto-detect file type and extract all transactions.

    Order of attempts for PDFs:
      1. ICICI-style table extraction (handles multi-page, continuation pages)
      2. Line-regex extraction (simple text PDFs)
      3. OCR (scanned PDFs)

    For images:
      - Direct OCR via Tesseract
    """
    # Handle image files directly
    if is_image_file(file_path):
        return extract_from_image(file_path, account_id, source_file)

    # PDF handling
    if is_text_based(file_path):
        # Primary: table extraction (ICICI Bank, structured PDFs)
        txns = _extract_icici_tables(file_path, account_id, source_file)
        if txns:
            return {'_meta_pdf_type': 'text-based (table)', 'transactions': txns}

        # Fallback: line regex
        txns = _extract_from_text_lines(file_path, account_id, source_file)
        return {'_meta_pdf_type': 'text-based (lines)', 'transactions': txns}

    # Scanned PDF: OCR
    try:
        lines = _ocr_lines_from_pdf(file_path)
        txns = _extract_from_ocr_lines(lines, account_id, source_file)
        return {'_meta_pdf_type': 'scanned (OCR)', 'transactions': txns}
    except ImportError:
        return {'_meta_pdf_type': 'scanned (OCR unavailable)', 'transactions': []}
