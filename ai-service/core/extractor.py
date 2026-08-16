import pdfplumber
import pytesseract
import os
from pdf2image import convert_from_path
from PIL import Image, ImageFilter, ImageEnhance

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
POPPLER_PATH = r"C:\poppler\Library\bin"

def extract_text_from_pdf(file_path: str) -> str:
    text = ""
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"

        if not text.strip():
            print("[INFO] No digital text found — switching to OCR")
            text = _ocr_pdf(file_path)

    finally:
        if os.path.exists(file_path):
            os.remove(file_path)
            print(f"[SECURITY] PDF deleted: {file_path}")

    return text.strip()


def _preprocess_image(image):
    """Clean up scanned image for better OCR accuracy."""
    # Convert to grayscale
    image = image.convert("L")
    
    # Increase contrast
    enhancer = ImageEnhance.Contrast(image)
    image = enhancer.enhance(2.0)
    
    # Sharpen
    image = image.filter(ImageFilter.SHARPEN)
    
    # Convert to black and white (binarize)
    image = image.point(lambda x: 0 if x < 140 else 255, "1")
    
    return image


def _ocr_pdf(file_path: str) -> str:
    text = ""
    images = convert_from_path(
        file_path,
        dpi=400,
        poppler_path=POPPLER_PATH
    )
    for i, image in enumerate(images):
        print(f"[OCR] Processing page {i + 1} of {len(images)}")
        
        # Preprocess for better accuracy
        cleaned = _preprocess_image(image)
        
        page_text = pytesseract.image_to_string(
            cleaned,
            lang="eng",
            config="--psm 6"  # Assume uniform block of text
        )
        text += page_text + "\n"
    
    return text