import os
import uuid
import secrets
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone, timedelta
from app.models.users import User
from app.models.rewards import RewardTransaction, MarketplaceItem, RedemptionTransaction, PayoutRequest, OrgPaymentRequest
import traceback

REWARD_MIN_INTERVAL_HOURS = int(os.getenv("REWARD_MIN_INTERVAL_HOURS", "24"))

async def credit_plant_registration_reward(
    db: AsyncSession,
    user_id: uuid.UUID,
    plant_id: uuid.UUID,
    points: int = 50
) -> bool:
    """
    Credits GXC coins when a user registers a new plant/tree.
    Awards 50 GXC coins immediately and records an append-only RewardTransaction.
    """
    try:
        # Check if already credited for this plant registration
        existing_tx = await db.execute(
            select(RewardTransaction).filter(
                RewardTransaction.user_id == user_id,
                RewardTransaction.plant_id == plant_id,
                RewardTransaction.trigger_event == "PLANT_REGISTERED"
            )
        )
        if existing_tx.scalar_one_or_none():
            return False

        # Fetch most recent balance snapshot for user
        latest_bal_res = await db.execute(
            select(RewardTransaction.balance_snapshot)
            .filter(RewardTransaction.user_id == user_id)
            .order_by(RewardTransaction.created_at.desc())
            .limit(1)
        )
        current_balance = latest_bal_res.scalar_one_or_none() or 0
        new_balance = current_balance + points

        new_tx = RewardTransaction(
            id=uuid.uuid4(),
            user_id=user_id,
            plant_id=plant_id,
            points=points,
            trigger_event="PLANT_REGISTERED",
            balance_snapshot=new_balance,
        )
        db.add(new_tx)
        await db.commit()
        return True
    except Exception as e:
        print(f"Error crediting plant registration reward: {e}")
        traceback.print_exc()
        await db.rollback()
        return False

async def credit_growth_update_reward(db: AsyncSession, user_id: uuid.UUID, plant_id: uuid.UUID) -> bool:
    """
    Credits a reward for a verified growth update.
    Uses row-level locking on the User to prevent concurrent double-credit.
    Returns True if credited, False if time-gated or user ineligible.
    """
    try:
        # 1. Lock the user record to strictly serialize all reward operations for this user
        result = await db.execute(select(User).filter(User.id == user_id).with_for_update())
        user = result.scalar_one_or_none()
        
        if not user:
            print(f"User {user_id} not found")
            return False
            
        # 2. Anti-Fraud: Ensure device fingerprint exists
        if not user.device_fingerprint:
            print(f"User {user_id} lacks device fingerprint, reward withheld.")
            return False

        # 3. Check for previous reward for this specific plant + event combination
        last_tx_result = await db.execute(
            select(RewardTransaction)
            .filter(
                RewardTransaction.user_id == user_id,
                RewardTransaction.plant_id == plant_id,
                RewardTransaction.trigger_event == 'GROWTH_UPDATE_VERIFIED'
            )
            .order_by(RewardTransaction.created_at.desc())
            .limit(1)
        )
        last_tx = last_tx_result.scalar_one_or_none()
        
        if last_tx:
            # Time-gating enforcement
            now = datetime.now(timezone.utc)
            # Make sure created_at is aware
            created_at = last_tx.created_at
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            
            delta = now - created_at
            if delta < timedelta(hours=REWARD_MIN_INTERVAL_HOURS):
                print(f"Time-gate active. {delta.total_seconds()/3600}h elapsed, {REWARD_MIN_INTERVAL_HOURS}h required.")
                return False

        # 4. Fetch the absolute most recent transaction for the user to determine current balance snapshot
        # (This is safe because we hold the User row lock, so no other transactions can insert concurrently)
        latest_balance_result = await db.execute(
            select(RewardTransaction.balance_snapshot)
            .filter(RewardTransaction.user_id == user_id)
            .order_by(RewardTransaction.created_at.desc())
            .limit(1)
        )
        current_balance = latest_balance_result.scalar_one_or_none() or 0
        
        # 5. Calculate new balance
        points_to_award = 10  # Configurable points for growth update
        new_balance = current_balance + points_to_award
        
        # 6. Insert new reward transaction (Append-only)
        new_tx = RewardTransaction(
            user_id=user_id,
            plant_id=plant_id,
            points=points_to_award,
            trigger_event='GROWTH_UPDATE_VERIFIED',
            balance_snapshot=new_balance
        )
        
        db.add(new_tx)
        await db.commit()
        return True
        
    except Exception as e:
        await db.rollback()
        print(f"Reward credit error: {e}")
        traceback.print_exc()
        return False


async def seed_default_marketplace_items(db: AsyncSession):
    """Seed default marketplace items if table is empty."""
    res = await db.execute(select(MarketplaceItem))
    items = res.scalars().all()
    if not items:
        default_items = [
            MarketplaceItem(
                title="Tree Planter Certificate & Badge",
                description="Digital verified NFT certificate for planting 5 native urban trees.",
                points_cost=30,
                category="Eco Badge",
                stock=500
            ),
            MarketplaceItem(
                title="$10 Botanical Nursery Voucher",
                description="Redeemable at partner organic nurseries for seeds and saplings.",
                points_cost=50,
                category="Eco Voucher",
                stock=100
            ),
            MarketplaceItem(
                title="Smart Soil Moisture Sensor Coupon",
                description="50% discount coupon for GreenXchange IoT soil monitoring sensors.",
                points_cost=75,
                category="Hardware",
                stock=50
            ),
            MarketplaceItem(
                title="Community Solar Carbon Offset Token",
                description="Offset 100kg CO2 via localized community solar energy projects.",
                points_cost=100,
                category="Carbon Offset",
                stock=200
            )
        ]
        db.add_all(default_items)
        await db.commit()


async def redeem_marketplace_item(db: AsyncSession, user_id: uuid.UUID, item_id: uuid.UUID) -> dict:
    """
    Redeems a marketplace item using GXC balance.
    Locks user and item rows to prevent race conditions.
    """
    try:
        # 1. Lock user
        user_res = await db.execute(select(User).filter(User.id == user_id).with_for_update())
        user = user_res.scalar_one_or_none()
        if not user:
            raise ValueError("User not found")

        # 2. Lock marketplace item
        item_res = await db.execute(select(MarketplaceItem).filter(MarketplaceItem.id == item_id).with_for_update())
        item = item_res.scalar_one_or_none()
        if not item or not item.is_active:
            raise ValueError("Item not available")
        if item.stock <= 0:
            raise ValueError("Item is out of stock")

        # 3. Check current balance
        bal_res = await db.execute(
            select(RewardTransaction.balance_snapshot)
            .filter(RewardTransaction.user_id == user_id)
            .order_by(RewardTransaction.created_at.desc())
            .limit(1)
        )
        current_balance = bal_res.scalar_one_or_none() or 0

        if current_balance < item.points_cost:
            raise ValueError(f"Insufficient GXC balance. You have {current_balance} pts, item requires {item.points_cost} pts.")

        # 4. Deduct stock & calculate new balance
        item.stock -= 1
        new_balance = current_balance - item.points_cost

        # 5. Insert negative transaction
        tx = RewardTransaction(
            user_id=user_id,
            points=-item.points_cost,
            trigger_event=f"MARKETPLACE_REDEEM_{item.title[:20].upper()}",
            balance_snapshot=new_balance
        )
        db.add(tx)

        # 6. Generate voucher code & create redemption record
        voucher = f"GXC-ECO-{secrets.token_hex(4).upper()}"
        redemption = RedemptionTransaction(
            user_id=user_id,
            item_id=item_id,
            points_spent=item.points_cost,
            voucher_code=voucher,
            status="CLAIMED"
        )
        db.add(redemption)

        await db.commit()
        await db.refresh(redemption)

        return {
            "success": True,
            "voucher_code": voucher,
            "new_balance": new_balance,
            "item_title": item.title,
            "redemption_id": str(redemption.id)
        }

    except Exception as e:
        await db.rollback()
        raise e


async def request_wallet_payout(db: AsyncSession, user_id: uuid.UUID, amount_gxc: int, wallet_address: str) -> PayoutRequest:
    """
    Submits a GXC token payout request to an external crypto wallet.
    Requires minimum threshold of 50 GXC and locks balance.
    """
    if amount_gxc < 50:
        raise ValueError("Minimum payout threshold is 50 GXC")

    if not wallet_address or not (wallet_address.startswith("0x") and len(wallet_address) == 42):
        raise ValueError("Invalid Web3 Ethereum/Polygon wallet address format (0x...)")

    try:
        # 1. Lock user
        user_res = await db.execute(select(User).filter(User.id == user_id).with_for_update())
        user = user_res.scalar_one_or_none()
        if not user:
            raise ValueError("User not found")

        # 2. Check balance
        bal_res = await db.execute(
            select(RewardTransaction.balance_snapshot)
            .filter(RewardTransaction.user_id == user_id)
            .order_by(RewardTransaction.created_at.desc())
            .limit(1)
        )
        current_balance = bal_res.scalar_one_or_none() or 0

        if current_balance < amount_gxc:
            raise ValueError(f"Insufficient GXC balance. Available: {current_balance} GXC, requested: {amount_gxc} GXC.")

        # 3. Calculate new balance & add append-only transaction
        new_balance = current_balance - amount_gxc
        tx = RewardTransaction(
            user_id=user_id,
            points=-amount_gxc,
            trigger_event="CRYPTO_WALLET_PAYOUT_PENDING",
            balance_snapshot=new_balance
        )
        db.add(tx)

        # 4. Create payout request
        payout = PayoutRequest(
            user_id=user_id,
            amount_gxc=amount_gxc,
            wallet_address=wallet_address,
            status="PENDING"
        )
        db.add(payout)

        await db.commit()
        await db.refresh(payout)
        return payout

    except Exception as e:
        await db.rollback()
        raise e


async def create_org_payment_request(
    db: AsyncSession,
    org_id: uuid.UUID,
    user_identifier: str,
    amount_gxc: int,
    service_description: str
) -> OrgPaymentRequest:
    """
    Organization issues a GXC payment request for an eco-service to a target user.
    """
    if amount_gxc <= 0:
        raise ValueError("Requested GXC payment amount must be greater than 0")

    # Resolve target user by UUID or Email
    query = select(User)
    try:
        user_uuid = uuid.UUID(user_identifier)
        query = query.filter((User.id == user_uuid) | (User.email == user_identifier))
    except ValueError:
        query = query.filter(User.email == user_identifier)

    user_res = await db.execute(query)
    target_user = user_res.scalars().first()

    if not target_user:
        raise ValueError(f"Target user '{user_identifier}' not found")

    if target_user.id == org_id:
        raise ValueError("Cannot issue a payment request to yourself")

    req = OrgPaymentRequest(
        org_id=org_id,
        user_id=target_user.id,
        amount_gxc=amount_gxc,
        service_description=service_description,
        status="PENDING"
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)

    # Fetch Org name for email notification
    org_res = await db.execute(select(User).filter(User.id == org_id))
    org_user = org_res.scalars().first()
    org_name = org_user.name if org_user else "Partner Organization"

    # Dispatch email notification to target citizen
    try:
        from app.worker.email_tasks import task_send_org_payment_request_email
        task_send_org_payment_request_email.delay(
            target_user.email,
            target_user.name,
            org_name,
            float(amount_gxc),
            service_description
        )
    except Exception:
        from app.services.email import send_org_payment_request_email
        await send_org_payment_request_email(
            target_user.email,
            target_user.name,
            org_name,
            float(amount_gxc),
            service_description
        )

    return req


async def approve_org_payment_request(
    db: AsyncSession,
    user_id: uuid.UUID,
    request_id: uuid.UUID,
    password: str
) -> dict:
    """
    User approves a pending organization payment request by confirming password.
    Deducts GXC from user via append-only ledger and credits organization.
    """
    from app.core.security import verify_password
    from datetime import datetime, timezone

    try:
        # 1. Lock user and verify password
        user_res = await db.execute(select(User).filter(User.id == user_id).with_for_update())
        user = user_res.scalar_one_or_none()
        if not user:
            raise ValueError("User not found")

        if not verify_password(password, user.password_hash):
            raise ValueError("Incorrect password authentication. Payment approval rejected.")

        # 2. Fetch pending request
        req_res = await db.execute(
            select(OrgPaymentRequest).filter(
                OrgPaymentRequest.id == request_id,
                OrgPaymentRequest.user_id == user_id,
                OrgPaymentRequest.status == "PENDING"
            ).with_for_update()
        )
        req = req_res.scalar_one_or_none()
        if not req:
            raise ValueError("Pending payment request not found or already processed")

        # 3. Check user balance
        bal_res = await db.execute(
            select(RewardTransaction.balance_snapshot)
            .filter(RewardTransaction.user_id == user_id)
            .order_by(RewardTransaction.created_at.desc())
            .limit(1)
        )
        user_bal = bal_res.scalar_one_or_none() or 0
        if user_bal < req.amount_gxc:
            raise ValueError(f"Insufficient GXC balance. Available: {user_bal} GXC, Required: {req.amount_gxc} GXC.")

        # 4. Deduct GXC from User via append-only transaction
        new_user_bal = user_bal - req.amount_gxc
        user_tx = RewardTransaction(
            user_id=user_id,
            points=-req.amount_gxc,
            trigger_event="ORG_SERVICE_PAYMENT",
            balance_snapshot=new_user_bal
        )
        db.add(user_tx)

        # 5. Lock Org & Credit Org account via append-only transaction
        org_res = await db.execute(select(User).filter(User.id == req.org_id).with_for_update())
        org_user = org_res.scalar_one_or_none()
        if org_user:
            org_bal_res = await db.execute(
                select(RewardTransaction.balance_snapshot)
                .filter(RewardTransaction.user_id == req.org_id)
                .order_by(RewardTransaction.created_at.desc())
                .limit(1)
            )
            org_bal = org_bal_res.scalar_one_or_none() or 0
            new_org_bal = org_bal + req.amount_gxc
            org_tx = RewardTransaction(
                user_id=req.org_id,
                points=req.amount_gxc,
                trigger_event="SERVICE_PAYMENT_RECEIVED",
                balance_snapshot=new_org_bal
            )
            db.add(org_tx)

        # 6. Update request status
        req.status = "APPROVED"
        req.processed_at = datetime.now(timezone.utc)

        await db.commit()

        return {
            "success": True,
            "new_balance": new_user_bal,
            "amount_paid": req.amount_gxc,
            "service_description": req.service_description,
            "request_id": str(req.id)
        }

    except Exception as e:
        await db.rollback()
        raise e


async def reject_org_payment_request(
    db: AsyncSession,
    user_id: uuid.UUID,
    request_id: uuid.UUID
) -> dict:
    """
    User rejects a pending organization payment request.
    """
    from datetime import datetime, timezone

    req_res = await db.execute(
        select(OrgPaymentRequest).filter(
            OrgPaymentRequest.id == request_id,
            OrgPaymentRequest.user_id == user_id,
            OrgPaymentRequest.status == "PENDING"
        )
    )
    req = req_res.scalar_one_or_none()
    if not req:
        raise ValueError("Pending payment request not found or already processed")

    req.status = "REJECTED"
    req.processed_at = datetime.now(timezone.utc)
    await db.commit()
    return {"success": True, "request_id": str(req.id), "status": "REJECTED"}


