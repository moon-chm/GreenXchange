from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, UUID4, Field

from app.api.deps import get_db, get_current_user
from app.models.users import User
from app.models.rewards import RewardTransaction, MarketplaceItem, RedemptionTransaction, PayoutRequest
from app.services.rewards import (
    seed_default_marketplace_items,
    redeem_marketplace_item,
    request_wallet_payout,
)

router = APIRouter()

class RewardTransactionResponse(BaseModel):
    id: UUID4
    plant_id: Optional[UUID4] = None
    points: int
    trigger_event: str
    balance_snapshot: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class BalanceResponse(BaseModel):
    balance: int
    recent_transactions: List[RewardTransactionResponse]

class MarketplaceItemResponse(BaseModel):
    id: UUID4
    title: str
    description: Optional[str] = None
    points_cost: int
    category: str
    image_url: Optional[str] = None
    stock: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class RedeemRequest(BaseModel):
    item_id: UUID4

class RedemptionResponse(BaseModel):
    id: UUID4
    item_id: UUID4
    points_spent: int
    voucher_code: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class RedeemSuccessResponse(BaseModel):
    success: bool
    voucher_code: str
    new_balance: int
    item_title: str
    redemption_id: str

class PayoutCreateRequest(BaseModel):
    amount_gxc: int = Field(..., ge=50, description="Minimum withdrawal is 50 GXC")
    wallet_address: str = Field(..., min_length=42, max_length=42, description="Ethereum/Polygon wallet address")

class PayoutResponse(BaseModel):
    id: UUID4
    amount_gxc: int
    wallet_address: str
    tx_hash: Optional[str] = None
    status: str
    created_at: datetime
    processed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


@router.get("/balance", response_model=BalanceResponse)
async def get_balance(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from app.models.plants import Plant
    from app.services.rewards import credit_plant_registration_reward

    # Ensure any previously registered plants have rewards credited
    plants_res = await db.execute(select(Plant).filter(Plant.owner_id == current_user.id))
    user_plants = plants_res.scalars().all()

    for p in user_plants:
        tx_check = await db.execute(
            select(RewardTransaction).filter(
                RewardTransaction.user_id == current_user.id,
                RewardTransaction.plant_id == p.id,
                RewardTransaction.trigger_event == "PLANT_REGISTERED"
            )
        )
        if not tx_check.scalar_one_or_none():
            await credit_plant_registration_reward(db, user_id=current_user.id, plant_id=p.id, points=50)

    result = await db.execute(
        select(RewardTransaction)
        .filter(RewardTransaction.user_id == current_user.id)
        .order_by(RewardTransaction.created_at.desc())
        .limit(10)
    )
    transactions = result.scalars().all()
    balance = transactions[0].balance_snapshot if transactions else 0
    return BalanceResponse(balance=balance, recent_transactions=transactions)


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


@router.get("/marketplace", response_model=List[MarketplaceItemResponse])
async def get_marketplace_items(
    db: AsyncSession = Depends(get_db)
):
    await seed_default_marketplace_items(db)
    result = await db.execute(
        select(MarketplaceItem)
        .filter(MarketplaceItem.is_active == True)
        .order_by(MarketplaceItem.points_cost.asc())
    )
    return result.scalars().all()


@router.post("/redeem", response_model=RedeemSuccessResponse)
async def redeem_item(
    payload: RedeemRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        res = await redeem_marketplace_item(db, user_id=current_user.id, item_id=payload.item_id)
        return RedeemSuccessResponse(**res)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Redemption failed: {str(e)}")


@router.get("/redemptions", response_model=List[RedemptionResponse])
async def get_my_redemptions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(RedemptionTransaction)
        .filter(RedemptionTransaction.user_id == current_user.id)
        .order_by(RedemptionTransaction.created_at.desc())
    )
    return result.scalars().all()


@router.post("/payout", response_model=PayoutResponse)
async def create_payout(
    payload: PayoutCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        payout = await request_wallet_payout(
            db,
            user_id=current_user.id,
            amount_gxc=payload.amount_gxc,
            wallet_address=payload.wallet_address
        )
        return payout
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Payout request failed: {str(e)}")


@router.get("/payouts", response_model=List[PayoutResponse])
async def get_my_payouts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(PayoutRequest)
        .filter(PayoutRequest.user_id == current_user.id)
        .order_by(PayoutRequest.created_at.desc())
    )
    return result.scalars().all()


# ─── Organization Payment Request Endpoints ────────────────────────────────────

class OrgPaymentCreateRequest(BaseModel):
    user_identifier: str = Field(..., description="User Email or User UUID")
    amount_gxc: int = Field(..., ge=1, description="Requested GXC amount")
    service_description: str = Field(..., min_length=3, max_length=255, description="Description of eco-service provided")

class OrgPaymentApproveRequest(BaseModel):
    request_id: UUID4
    password: str

class OrgPaymentRejectRequest(BaseModel):
    request_id: UUID4

class OrgPaymentItemResponse(BaseModel):
    id: UUID4
    org_id: UUID4
    user_id: UUID4
    amount_gxc: int
    service_description: str
    status: str
    created_at: datetime
    org_name: Optional[str] = None
    user_email: Optional[str] = None

    class Config:
        from_attributes = True


@router.post("/org-request-payment")
async def issue_org_payment_request(
    payload: OrgPaymentCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from app.services.rewards import create_org_payment_request
    try:
        req = await create_org_payment_request(
            db,
            org_id=current_user.id,
            user_identifier=payload.user_identifier,
            amount_gxc=payload.amount_gxc,
            service_description=payload.service_description
        )
        return {"success": True, "request_id": str(req.id), "status": req.status}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to issue payment request: {str(e)}")


@router.get("/pending-org-requests", response_model=List[OrgPaymentItemResponse])
async def get_pending_org_requests(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from app.models.rewards import OrgPaymentRequest
    result = await db.execute(
        select(OrgPaymentRequest, User.name.label("org_name"))
        .join(User, User.id == OrgPaymentRequest.org_id)
        .filter(
            OrgPaymentRequest.user_id == current_user.id,
            OrgPaymentRequest.status == "PENDING"
        )
        .order_by(OrgPaymentRequest.created_at.desc())
    )
    rows = result.all()
    items = []
    for req, org_name in rows:
        items.append(OrgPaymentItemResponse(
            id=req.id,
            org_id=req.org_id,
            user_id=req.user_id,
            amount_gxc=req.amount_gxc,
            service_description=req.service_description,
            status=req.status,
            created_at=req.created_at,
            org_name=org_name or "Partner Organization"
        ))
    return items


@router.post("/approve-org-request")
async def approve_payment_request(
    payload: OrgPaymentApproveRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from app.services.rewards import approve_org_payment_request
    try:
        res = await approve_org_payment_request(
            db,
            user_id=current_user.id,
            request_id=payload.request_id,
            password=payload.password
        )
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Approval failed: {str(e)}")


@router.post("/reject-org-request")
async def reject_payment_request(
    payload: OrgPaymentRejectRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from app.services.rewards import reject_org_payment_request
    try:
        res = await reject_org_payment_request(
            db,
            user_id=current_user.id,
            request_id=payload.request_id
        )
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Rejection failed: {str(e)}")


@router.get("/org-issued-requests", response_model=List[OrgPaymentItemResponse])
async def get_org_issued_requests(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from app.models.rewards import OrgPaymentRequest
    result = await db.execute(
        select(OrgPaymentRequest, User.email.label("user_email"))
        .join(User, User.id == OrgPaymentRequest.user_id)
        .filter(OrgPaymentRequest.org_id == current_user.id)
        .order_by(OrgPaymentRequest.created_at.desc())
    )
    rows = result.all()
    items = []
    for req, user_email in rows:
        items.append(OrgPaymentItemResponse(
            id=req.id,
            org_id=req.org_id,
            user_id=req.user_id,
            amount_gxc=req.amount_gxc,
            service_description=req.service_description,
            status=req.status,
            created_at=req.created_at,
            user_email=user_email
        ))
    return items


