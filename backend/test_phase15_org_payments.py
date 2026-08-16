import asyncio
import uuid
from sqlalchemy.future import select
from app.db.session import AsyncSessionLocal
from app.models.users import User
from app.models.rewards import OrgPaymentRequest, RewardTransaction
from app.services.rewards import (
    create_org_payment_request,
    approve_org_payment_request,
    reject_org_payment_request
)
from app.core.security import get_password_hash

async def main():
    print("==================================================")
    print("Testing Phase 15: Organization Payment Request & Password Approval")
    print("==================================================")

    async with AsyncSessionLocal() as session:
        # Create test org & user
        org_user = User(
            id=uuid.uuid4(),
            email=f"org_{uuid.uuid4().hex[:6]}@nursery.org",
            password_hash=get_password_hash("OrgPass123!"),
            name="Green Nursery Org",
            location_lat=28.6139,
            location_lng=77.2090
        )
        payer_user = User(
            id=uuid.uuid4(),
            email=f"payer_{uuid.uuid4().hex[:6]}@example.com",
            password_hash=get_password_hash("PayerPass123!"),
            name="Garden Payer",
            location_lat=28.6139,
            location_lng=77.2090
        )
        session.add_all([org_user, payer_user])
        await session.flush()

        # Seed payer with 100 GXC
        session.add(RewardTransaction(
            user_id=payer_user.id,
            points=100,
            trigger_event="REGISTRATION",
            balance_snapshot=100
        ))
        await session.commit()

        payer_id = payer_user.id
        org_id = org_user.id

        print(f"1. Created Org ({org_user.name}) and Payer ({payer_user.email}) with 100 GXC balance.")

        # 2. Org issues payment request of 40 GXC
        req = await create_org_payment_request(
            session,
            org_id=org_id,
            user_identifier=payer_user.email,
            amount_gxc=40,
            service_description="Sapling Delivery & Organic Fertilizer Service"
        )
        req_id = req.id
        assert req.status == "PENDING"
        assert req.amount_gxc == 40
        print(f"SUCCESS: Org issued payment request (ID: {req_id}) for 40 GXC.")

        # 3. Test wrong password approval (should fail)
        try:
            await approve_org_payment_request(session, user_id=payer_id, request_id=req_id, password="WRONG_PASSWORD")
            assert False, "Should fail with wrong password"
        except ValueError as e:
            await session.rollback()
            print(f"SUCCESS: Incorrect password rejected with error: '{e}'")

        # 4. Test correct password approval
        res = await approve_org_payment_request(session, user_id=payer_id, request_id=req_id, password="PayerPass123!")
        assert res["success"] is True
        assert res["new_balance"] == 60
        print(f"SUCCESS: Payment approved with correct password! Payer new balance: {res['new_balance']} GXC.")

        # 5. Verify Org balance received 40 GXC
        org_bal_res = await session.execute(
            select(RewardTransaction.balance_snapshot)
            .filter(RewardTransaction.user_id == org_id)
            .order_by(RewardTransaction.created_at.desc())
            .limit(1)
        )
        org_bal = org_bal_res.scalar_one_or_none()
        assert org_bal == 40, "Org should have received 40 GXC"
        print(f"SUCCESS: Org received 40 GXC (Current Org Balance: {org_bal} GXC).")

        # 6. Test rejection flow
        req2 = await create_org_payment_request(
            session,
            org_id=org_id,
            user_identifier=payer_user.email,
            amount_gxc=20,
            service_description="Soil pH Testing"
        )
        rej = await reject_org_payment_request(session, user_id=payer_id, request_id=req2.id)
        assert rej["status"] == "REJECTED"
        print(f"SUCCESS: Second payment request correctly REJECTED.")

        # Cleanup
        await session.execute(select(OrgPaymentRequest).filter(OrgPaymentRequest.org_id == org_user.id))
        print("Cleanup completed successfully.")

if __name__ == "__main__":
    asyncio.run(main())
