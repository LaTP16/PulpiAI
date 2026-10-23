from pydantic import BaseModel, Field
from typing import Literal, Optional

MovementType = Literal['income', 'expense']

class VoiceParseRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Spoken transcript or text message")

class VoiceParseResponse(BaseModel):
    type: MovementType
    amount: float
    currency: str = "PEN"
    description: str
    category: str
    date: str
    confidence: float
    needs_confirmation: bool
    explanation: Optional[str] = None
