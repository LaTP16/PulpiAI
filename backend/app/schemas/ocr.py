from pydantic import BaseModel
from typing import Literal, Optional, List

DocumentType = Literal[
    'boleta_factura',
    'voucher_pago',
    'comprobante_ingreso',
    'captura_financiera',
    'imagen_no_financiera'
]

OperationType = Literal['income', 'expense', 'none']

class CandidateAmount(BaseModel):
    label: str
    amount: float
    confidence_score: float

class OCRParseResponse(BaseModel):
    is_financial: bool
    document_type: DocumentType
    document_type_label: str
    operation_type: OperationType
    amount: float
    currency: str = "PEN"
    description: str
    category: str
    date: str
    entity_name: Optional[str] = None  # Merchant, sender, recipient, or bank
    candidate_amounts: List[CandidateAmount] = []
    raw_text: str
    confidence: float
    needs_confirmation: bool
    status_message: str
