from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
from datetime import datetime

from app.api.deps import get_db, get_current_user
from app.models.users import User
from app.models.rewards import RewardTransaction
from pydantic import BaseModel, UUID4

router = APIRouter()

class RewardTransactionResponse(BaseModel):
    id: UUID4
    plant_id: UUID4 | None
    points: int
    trigger_event: str
    balance_snapshot: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class BalanceResponse(BaseModel):
    balance: int
    recent_transactions: List[RewardTransactionResponse]

@router.get("/balance", response_model=BalanceResponse)
async def get_balance(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Fetch most recent transaction
    result = await db.execute(
        select(RewardTransaction)
        .filter(RewardTransaction.user_id == current_user.id)
        .order_by(RewardTransaction.created_at.desc())
        .limit(5)
    )
    transactions = result.scalars().all()
    
    balance = transactions[0].balance_snapshot if transactions else 0
    
    return BalanceResponse(
        balance=balance,
        recent_transactions=transactions
    )

@router.get("/history", response_model=List[RewardTransactionResponse])
async def get_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(RewardTransaction)
        .filter(RewardTransaction.user_id == current_user.id)
        .order_by(RewardTransaction.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()
