"""
routes/accounts.py — CRUD for bank_accounts table.

GET  /accounts         → list all accounts
POST /accounts         → create an account
PUT  /accounts/{id}    → update balance / details
DELETE /accounts/{id}  → delete account
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from database.supabase_client import get_client

router = APIRouter()


class AccountIn(BaseModel):
    account_name:   str
    account_number: Optional[str] = None
    bank_name:      str
    currency:       str = "INR"
    balance:        float = 0.0


@router.get("/", summary="List all bank accounts")
def list_accounts():
    client = get_client()
    if not client:
        raise HTTPException(503, "Database not configured")
    resp = client.table("bank_accounts").select("*").execute()
    return resp.data or []


@router.post("/", summary="Add a bank account")
def create_account(body: AccountIn):
    client = get_client()
    if not client:
        raise HTTPException(503, "Database not configured")
    resp = client.table("bank_accounts").insert(body.model_dump()).execute()
    return resp.data


@router.put("/{account_id}", summary="Update a bank account")
def update_account(account_id: str, body: AccountIn):
    client = get_client()
    if not client:
        raise HTTPException(503, "Database not configured")
    resp = client.table("bank_accounts") \
        .update(body.model_dump()) \
        .eq("id", account_id).execute()
    return resp.data


@router.delete("/{account_id}", summary="Delete a bank account")
def delete_account(account_id: str):
    client = get_client()
    if not client:
        raise HTTPException(503, "Database not configured")
    client.table("bank_accounts").delete().eq("id", account_id).execute()
    return {"deleted": account_id}
