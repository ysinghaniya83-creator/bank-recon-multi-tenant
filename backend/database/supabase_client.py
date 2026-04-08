"""
supabase_client.py — Singleton Supabase client for the FastAPI backend.

Uses the SERVICE KEY (not the anon key) so it can bypass Row Level Security
when inserting extracted transactions from a trusted server process.

Environment variables (set in .env for local, Render dashboard for prod):
  SUPABASE_URL          https://xxxx.supabase.co
  SUPABASE_SERVICE_KEY  eyJhbGc...  (Service Role key — keep secret!)
"""
import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()  # reads .env in the working directory (ignored on Render)


@lru_cache(maxsize=1)
def get_client():
    """
    Return a Supabase client, or None if credentials are not configured.
    lru_cache ensures we build the client only once per process.
    """
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_KEY", "").strip()

    if not url or not key:
        return None  # backend runs without DB — transactions returned but not stored

    try:
        from supabase import create_client
        return create_client(url, key)
    except Exception as exc:
        print(f"[supabase] Failed to create client: {exc}")
        return None
