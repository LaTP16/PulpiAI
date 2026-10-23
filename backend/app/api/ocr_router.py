from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional
from app.schemas.ocr import OCRParseResponse
from app.services.ocr_service import OCRService

router = APIRouter(prefix="/ocr", tags=["ocr"])

@router.post("/analyze-image", response_model=OCRParseResponse)
async def analyze_image(file: UploadFile = File(...)):
    # Validate content type
    valid_content_types = ["image/jpeg", "image/png", "image/webp", "image/bmp", "image/tiff"]
    if file.content_type and file.content_type not in valid_content_types:
        raise HTTPException(
            status_code=400,
            detail=f"Formato no compatible ({file.content_type}). Usa JPEG, PNG o WEBP."
        )

    content = await file.read()
    if len(content) < 50:
        raise HTTPException(
            status_code=400,
            detail="El archivo proporcionado está vacío o corrupto."
        )

    try:
        return OCRService.process_image(content)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error durante el procesamiento OCR: {str(e)}"
        )

@router.post("/analyze-text", response_model=OCRParseResponse)
def analyze_text(text: str = Form(...)):
    """Analyze raw OCR text directly (used in tests and validation simulators)."""
    return OCRService.analyze_document_text(text)
