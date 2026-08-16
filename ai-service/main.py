from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core import analyzer

app = FastAPI(title="Bureaucracy Translator AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "AI service running"}

app.include_router(analyzer.router, prefix="/api")