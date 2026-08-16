import asyncio
from sqlalchemy import text, select
from app.db.session import AsyncSessionLocal
from app.models.users import User

EMAILS_TO_DELETE = [
    "prathameshsalokhe901@gmail.com",
    "harshadfagare@gmail.com"
]

async def delete_users():
    print(f"🗑️ Deleting users: {EMAILS_TO_DELETE}")
    async with AsyncSessionLocal() as session:
        for email in EMAILS_TO_DELETE:
            result = await session.execute(select(User).filter(User.email.ilike(email.strip())))
            user = result.scalars().first()
            if not user:
                print(f"⚠️ User with email '{email}' not found in database.")
                continue

            user_id = str(user.id)
            print(f"Found User '{user.name}' ({user.email}) [ID: {user_id}]. Cleaning associated records...")

            # Clean up known FKs with ON DELETE CASCADE or explicit deletes
            clean_queries = [
                "DELETE FROM growth_updates WHERE plant_id IN (SELECT id FROM plants WHERE owner_id = :uid)",
                "DELETE FROM plants WHERE owner_id = :uid",
                "DELETE FROM payment_requests WHERE payer_id = :uid OR org_id = :uid",
                "DELETE FROM payout_requests WHERE user_id = :uid",
                "DELETE FROM redemptions WHERE user_id = :uid",
                "DELETE FROM reward_transactions WHERE user_id = :uid",
                "DELETE FROM drive_participants WHERE user_id = :uid",
                "DELETE FROM users WHERE id = :uid"
            ]

            for q in clean_queries:
                try:
                    await session.execute(text(q), {"uid": user_id})
                except Exception as e:
                    # Ignore non-existent tables or constraints
                    pass

            await session.commit()
            print(f"✅ Successfully deleted user '{email}' and all associated records.")

if __name__ == "__main__":
    asyncio.run(delete_users())
