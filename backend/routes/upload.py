"""
routes/upload.py — POST /upload

Accepts PDF or image (JPG/PNG/WEBP) bank statements.
Returns extracted transactions and optionally saves to Supabase.
"""
import os
import tempfile

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from database.supabase_client import get_client
from parser.pdf_parser import extract_transactions, is_image_file

router = APIRouter()

ALLOWED_MIME = {
    'application/pdf',
    'image/jpeg', 'image/jpg', 'image/png',
    'image/webp', 'image/bmp', 'image/tiff',
    'application/octet-stream',   # fallback when browser sends generic type
}
ALLOWED_EXT = {'.pdf', '.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff', '.tif'}
MAX_FILE_SIZE = 30 * 1024 * 1024  # 30 MB


def _get_extension(filename: str) -> str:
    return os.path.splitext(filename or '')[1].lower()


@router.post('/upload', summary='Upload PDF or image bank statement')
async def upload_statement(
    file: UploadFile = File(...),
    account_id: str  = Form(...),
    save_to_db: bool = Form(True),
):
    ext = _get_extension(file.filename)

    # Validate file type
    if ext not in ALLOWED_EXT and file.content_type not in ALLOWED_MIME:
        raise HTTPException(
            status_code=400,
            detail=f'Unsupported file type. Upload a PDF or image (JPG/PNG/WEBP). Got: {file.content_type}'
        )

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail='File too large. Max 30 MB.')

    # Write to a temp file with the correct extension so parsers can detect type
    tmp_path = None
    try:
        suffix = ext if ext in ALLOWED_EXT else '.pdf'
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(contents)
            tmp_path = tmp.name

        # Extract transactions
        result   = extract_transactions(tmp_path, account_id, file.filename)
        pdf_type = result.pop('_meta_pdf_type', 'unknown')
        txn_list = result.get('transactions', [])

        # Optionally persist to Supabase
        saved = False
        if save_to_db and txn_list:
            client = get_client()
            if client:
                client.table('transactions').insert(txn_list).execute()
                saved = True

                # Update account balance to the last known running balance
                last_balance = txn_list[-1].get('balance')
                if last_balance is not None:
                    client.table('bank_accounts') \
                        .update({'balance': last_balance}) \
                        .eq('id', account_id).execute()

        return {
            'status':             'success',
            'pdf_type':           pdf_type,
            'transactions_count': len(txn_list),
            'transactions':       txn_list,
            'saved_to_db':        saved,
            'filename':           file.filename,
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'Extraction failed: {str(exc)}')
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
