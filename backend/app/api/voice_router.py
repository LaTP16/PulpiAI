from fastapi import APIRouter
from app.schemas.voice import VoiceParseRequest, VoiceParseResponse
from app.services.voice_service import VoiceService

router = APIRouter(prefix="/voice", tags=["voice"])

@router.post("/parse", response_model=VoiceParseResponse)
def parse_voice(payload: VoiceParseRequest):
    return VoiceService.parse_transcript(payload.text)
