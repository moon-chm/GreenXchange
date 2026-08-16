import asyncio
from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.users import User

async def list_users():
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(User))
        users = res.scalars().all()
        print(f"Total Users in DB: {len(users)}")
        for u in users:
            print(f"- Name: '{u.name}', Email: '{u.email}', Active: {u.is_active}, Verified: {getattr(u, 'email_verified', None)}")

if __name__ == "__main__":
    asyncio.run(list_users())
