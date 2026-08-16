import asyncio
import logging
from app.worker.celery_app import celery_app
from app.services.email import (
    send_verification_email,
    send_password_reset_email,
    send_org_payment_request_email,
    send_weekly_digest_email
)
from app.db.session import AsyncSessionLocal
from sqlalchemy import select, func
from app.models.users import User
from app.models.plants import Plant
from app.models.rewards import RewardTransaction

logger = logging.getLogger(__name__)

def _run_async(coro):
    """Helper to run async coroutines in synchronous Celery task workers."""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)

@celery_app.task(name="app.worker.email_tasks.task_send_verification_email")
def task_send_verification_email(to_email: str, name: str, token: str, base_url: str = None):
    logger.info(f"📧 Dispatching verification email task to: {to_email}")
    return _run_async(send_verification_email(to_email, name, token, base_url))

@celery_app.task(name="app.worker.email_tasks.task_send_password_reset_email")
def task_send_password_reset_email(to_email: str, name: str, token: str, base_url: str = None):
    logger.info(f"📧 Dispatching password reset email task to: {to_email}")
    return _run_async(send_password_reset_email(to_email, name, token, base_url))

@celery_app.task(name="app.worker.email_tasks.task_send_org_payment_request_email")
def task_send_org_payment_request_email(to_email: str, citizen_name: str, org_name: str, amount_gxc: float, description: str, base_url: str = None):
    logger.info(f"📧 Dispatching org payment request email task to: {to_email}")
    return _run_async(send_org_payment_request_email(to_email, citizen_name, org_name, amount_gxc, description, base_url))

async def _process_weekly_digests():
    async with AsyncSessionLocal() as session:
        users_res = await session.execute(select(User).filter(User.is_active == True, User.is_org == False))
        users = users_res.scalars().all()
        for u in users:
            # Calculate stats
            p_res = await session.execute(select(func.count(Plant.id)).filter(Plant.owner_id == u.id))
            p_count = p_res.scalar() or 0
            
            r_res = await session.execute(
                select(RewardTransaction.balance_snapshot)
                .filter(RewardTransaction.user_id == u.id)
                .order_by(RewardTransaction.created_at.desc())
                .limit(1)
            )
            balance = r_res.scalar() or 0
            
            stats = {
                "plants_count": p_count,
                "carbon_offset_kg": float(p_count * 22.5),
                "gxc_balance": balance
            }
            await send_weekly_digest_email(u.email, u.name, stats)

@celery_app.task(name="app.worker.email_tasks.task_send_weekly_digest")
def task_send_weekly_digest():
    logger.info("📊 Starting weekly eco-activity digest batch dispatch...")
    return _run_async(_process_weekly_digests())
