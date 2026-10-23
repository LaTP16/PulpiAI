from pydantic import BaseModel, Field
from typing import Literal, Optional, List, Dict

MovementType = Literal['income', 'expense']

class TransactionBase(BaseModel):
    type: MovementType
    amount: float = Field(..., gt=0)
    category: str
    description: str
    date: str
    currency: str = "PEN"

class TransactionCreate(TransactionBase):
    source: Optional[str] = "manual"
    is_demo: Optional[bool] = False

class TransactionUpdate(BaseModel):
    type: Optional[MovementType] = None
    amount: Optional[float] = Field(None, gt=0)
    category: Optional[str] = None
    description: Optional[str] = None
    date: Optional[str] = None
    currency: Optional[str] = None

class TransactionResponse(TransactionBase):
    id: str
    user_id: str
    source: str = "manual"
    is_demo: bool = False
    created_at: Optional[str] = None

class WeeklyDay(BaseModel):
    label: str
    date: str
    income: float
    expense: float

class CategoryTotal(BaseModel):
    category: str
    total: float
    type: MovementType

class TransactionSummary(BaseModel):
    income: float
    expense: float
    balance: float
    total_count: int
    weekly: List[WeeklyDay]
    categories: List[CategoryTotal]
