import asyncio
import uuid
import secrets
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.users import User
from app.services.email import (
    send_verification_email,
    send_password_reset_email,
    send_org_payment_request_email,
    send_weekly_digest_email
)
from app.core.security import get_password_hash, verify_password

async def test_email_suite():
    print("=" * 50)
    print("Testing Phase 16: Email System & Verification Flows")
    print("=" * 50)

    test_email = f"citizen_{uuid.uuid4().hex[:6]}@example.com"
    test_password = "SecurePassword123!"
    new_password = "UpdatedPassword456!"

    async with AsyncSessionLocal() as session:
        # 1. Simulate User Registration
        v_token = secrets.token_urlsafe(32)
        user = User(
            id=uuid.uuid4(),
            name="Eco Citizen",
            email=test_email,
            password_hash=get_password_hash(test_password),
            email_verified=False,
            is_active=False,
            email_verification_token=v_token,
            email_verification_expires_at=datetime.now(timezone.utc) + timedelta(hours=24)
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        print(f"1. Registered unverified user: {test_email} (Verified: {user.email_verified}, Active: {user.is_active})")

        # 2. Test Verification Email Service Function
        res_v = await send_verification_email(user.email, user.name, v_token)
        assert res_v is not None, "Verification email service should return response/mock"
        print("SUCCESS: Verification email dispatched successfully.")

        # 3. Simulate User Email Verification Click
        res_check = await session.execute(select(User).filter(User.email_verification_token == v_token))
        v_user = res_check.scalar_one_or_none()
        assert v_user is not None, "User should be found by verification token"
        
        v_user.email_verified = True
        v_user.is_active = True
        v_user.email_verification_token = None
        v_user.email_verification_expires_at = None
        await session.commit()
        print(f"SUCCESS: Email verified! Account activated for '{test_email}'")

        # 4. Test Forgot Password Workflow
        reset_token = secrets.token_urlsafe(32)
        v_user.password_reset_token = reset_token
        v_user.password_reset_expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        await session.commit()
        
        res_pw = await send_password_reset_email(v_user.email, v_user.name, reset_token)
        assert res_pw is not None, "Password reset email should be dispatched"
        print("SUCCESS: Password reset email dispatched.")

        # 5. Simulate Password Reset Confirmation
        res_reset = await session.execute(select(User).filter(User.password_reset_token == reset_token))
        reset_user = res_reset.scalar_one_or_none()
        assert reset_user is not None, "User should be found by reset token"
        
        reset_user.password_hash = get_password_hash(new_password)
        reset_user.password_reset_token = None
        reset_user.password_reset_expires_at = None
        await session.commit()
        
        # Verify old password fails and new password works
        assert not verify_password(test_password, reset_user.password_hash), "Old password should no longer match"
        assert verify_password(new_password, reset_user.password_hash), "New password should authenticate cleanly"
        print("SUCCESS: Password reset confirmed and verified.")

        # 6. Test Org Payment Notification Email
        res_org_email = await send_org_payment_request_email(
            to_email=test_email,
            citizen_name="Eco Citizen",
            org_name="Municipal Green Nursery",
            amount_gxc=50.0,
            description="Sapling Distribution & Botanical Soil Kit"
        )
        assert res_org_email is not None, "Org payment email should dispatch cleanly"
        print("SUCCESS: Org payment request notification email dispatched.")

        # 7. Test Weekly Digest Email Dispatch
        res_digest = await send_weekly_digest_email(
            to_email=test_email,
            name="Eco Citizen",
            stats={"plants_count": 4, "carbon_offset_kg": 90.0, "gxc_balance": 150}
        )
        assert res_digest is not None, "Weekly digest email should dispatch cleanly"
        print("SUCCESS: Weekly eco-activity digest email dispatched.")

        # Cleanup test user
        await session.delete(user)
        await session.commit()
        print("Cleanup completed successfully.")

    print("\n✅ Phase 16 Email Suite PASSED!")

if __name__ == "__main__":
    asyncio.run(test_email_suite())
