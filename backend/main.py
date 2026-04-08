"""
Bank Reconciliation API — FastAPI entry point
Deploy on Render.com (free tier)
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.upload import router as upload_router
from routes.accounts import router as accounts_router
from routes.transactions import router as transactions_router

app = FastAPI(
    title="Bank Reconciliation API",
    description="PDF parsing + Supabase storage for bank reconciliation",
    version="1.0.0",
)

# Allow requests from your Vercel frontend (and localhost for dev)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Tighten to your Vercel URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route groups
app.include_router(upload_router,       prefix="",           tags=["Upload"])
app.include_router(accounts_router,     prefix="/accounts",  tags=["Accounts"])
app.include_router(transactions_router, prefix="/transactions", tags=["Transactions"])


@app.get("/health", tags=["Health"])
def health_check():
    """Render.com uses this to verify the service is up."""
    return {"status": "ok", "service": "bank-reconciliation-api"}


@app.get("/", tags=["Health"])
def root():
    return {"message": "Bank Reconciliation API is running. POST /upload to parse a PDF."}
