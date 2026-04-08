"""
routes/transactions.py — Read & filter transactions.

GET /transactions                    → all (limit 500)
GET /transactions?account_id=xxx    → filter by account
GET /transactions?from=2026-03-01&to=2026-03-31
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from database.supabase_client import get_client

router = APIRouter()


@router.get("/", summary="List transactions with optional filters")
def list_transactions(
    account_id: Optional[str]  = Query(None),
    from_date:  Optional[str]  = Query(None, alias="from"),
    to_date:    Optional[str]  = Query(None, alias="to"),
    limit:      int            = Query(500, ge=1, le=2000),
):
    client = get_client()
    if not client:
        raise HTTPException(503, "Database not configured")

    q = client.table("transactions").select("*").order("date", desc=True).limit(limit)

    if account_id:
        q = q.eq("account_id", account_id)
    if from_date:
        q = q.gte("date", from_date)
    if to_date:
        q = q.lte("date", to_date)

    resp = q.execute()
    return resp.data or []
