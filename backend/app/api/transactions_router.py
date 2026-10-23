from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from app.schemas.transaction import (
    TransactionCreate,
    TransactionUpdate,
    TransactionResponse,
    TransactionSummary
)
from app.services.transaction_service import TransactionService
from app.database.seed_data import DEMO_USER_ID

router = APIRouter(prefix="/transactions", tags=["transactions"])

@router.get("", response_model=List[TransactionResponse])
def list_transactions(
    user_id: str = DEMO_USER_ID,
    type: Optional[str] = Query(None, description="income or expense"),
    category: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None)
):
    return TransactionService.get_transactions(
        user_id=user_id,
        type_filter=type,
        category_filter=category,
        from_date=from_date,
        to_date=to_date
    )

@router.get("/summary", response_model=TransactionSummary)
def get_summary(user_id: str = DEMO_USER_ID):
    return TransactionService.get_summary(user_id=user_id)

@router.get("/{tx_id}", response_model=TransactionResponse)
def get_transaction(tx_id: str, user_id: str = DEMO_USER_ID):
    tx = TransactionService.get_transaction_by_id(tx_id, user_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Movimiento no encontrado")
    return tx

@router.post("", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
def create_transaction(payload: TransactionCreate, user_id: str = DEMO_USER_ID):
    return TransactionService.create_transaction(user_id=user_id, data=payload)

@router.put("/{tx_id}", response_model=TransactionResponse)
def update_transaction(tx_id: str, payload: TransactionUpdate, user_id: str = DEMO_USER_ID):
    updated = TransactionService.update_transaction(tx_id=tx_id, user_id=user_id, data=payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Movimiento no encontrado para actualizar")
    return updated

@router.delete("/{tx_id}", status_code=status.HTTP_200_OK)
def delete_transaction(tx_id: str, user_id: str = DEMO_USER_ID):
    success = TransactionService.delete_transaction(tx_id=tx_id, user_id=user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Movimiento no encontrado para eliminar")
    return {"success": True, "message": "Movimiento eliminado correctamente"}
