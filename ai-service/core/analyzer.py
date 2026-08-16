from fastapi import APIRouter, UploadFile, File, HTTPException
import shutil, os, json
from core.extractor import extract_text_from_pdf
from core.pii_stripper import strip_pii
from core.gemini_analyzer import analyze_agreement

router = APIRouter()

GOLD_STANDARD_PATH = os.path.join(os.path.dirname(__file__), "../data/gold_standard.json")
with open(GOLD_STANDARD_PATH, "r") as f:
    gold_standard = json.load(f)

UPLOAD_DIR = "temp_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    temp_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    print(f"[INFO] Received: {file.filename}")

    raw_text = extract_text_from_pdf(temp_path)
    print(f"[INFO] Extracted {len(raw_text)} characters")

    clean_text = strip_pii(raw_text)
    print(f"[INFO] PII stripped")
    print(f"[DEBUG] Extracted text sample: {clean_text[:1000]}")

    result = analyze_agreement(clean_text, gold_standard)
    print(f"[INFO] Analysis complete")

    return result