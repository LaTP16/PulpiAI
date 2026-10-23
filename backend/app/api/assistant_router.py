from fastapi import APIRouter
from pydantic import BaseModel
from app.services.ai_service import AIService, _resolve_gemini_api_key
from app.database.seed_data import DEMO_USER_ID

router = APIRouter(prefix="/assistant", tags=["assistant"])


class AssistantChatRequest(BaseModel):
    question: str
    user_id: str = DEMO_USER_ID


class AssistantChatResponse(BaseModel):
    answer: str
    provider: str
    model: str


@router.post("/chat", response_model=AssistantChatResponse)
def chat_with_assistant(payload: AssistantChatRequest):
    return AIService.ask_assistant(question=payload.question, user_id=payload.user_id)


@router.get("/status")
def assistant_status():
    has_key = bool(_resolve_gemini_api_key())
    return {
        "ai_configured": has_key,
        "provider": "gemini" if has_key else "local_fallback",
    }
