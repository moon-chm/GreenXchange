import os
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone, timedelta
from app.models.users import User
from app.models.rewards import RewardTransaction
import traceback

REWARD_MIN_INTERVAL_HOURS = int(os.getenv("REWARD_MIN_INTERVAL_HOURS", "24"))

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
