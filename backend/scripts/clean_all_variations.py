import asyncio
from sqlalchemy import text, select
from app.db.session import AsyncSessionLocal
from app.models.users import User

async def clean_all_variations():
    patterns = ["%salokhe%", "%harshad%", "%fagare%"]
    async with AsyncSessionLocal() as session:
        for pat in patterns:
            res = await session.execute(select(User).filter(User.email.ilike(pat)))
            users = res.scalars().all()
            for u in users:
                uid = str(u.id)
                print(f"Deleting user: '{u.name}' | email='{u.email}' (ID: {uid})")
                
                # Delete related records
                queries = [
                    "DELETE FROM growth_updates WHERE plant_id IN (SELECT id FROM plants WHERE owner_id = :uid)",
                    "DELETE FROM plants WHERE owner_id = :uid",
                    "DELETE FROM payment_requests WHERE payer_id = :uid OR org_id = :uid",
                    "DELETE FROM payout_requests WHERE user_id = :uid",
                    "DELETE FROM redemptions WHERE user_id = :uid",
                    "DELETE FROM reward_transactions WHERE user_id = :uid",
                    "DELETE FROM drive_participants WHERE user_id = :uid",
                    "DELETE FROM users WHERE id = :uid"
                ]
                for q in queries:
                    try:
                        await session.execute(text(q), {"uid": uid})
                    except Exception:
                        pass

        await session.commit()
        print("✅ Finished deleting all matching accounts!")

if __name__ == "__main__":
    asyncio.run(clean_all_variations())
