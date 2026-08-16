import asyncio
from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.users import User

async def main():
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(User))
        users = res.scalars().all()
        print("--- ALL USERS IN DB ---")
        for u in users:
            print(f"Email: {u.email} | Name: {u.name} | Role: {getattr(u, 'role', None)} | IsOrg: {getattr(u, 'is_org', None)}")

if __name__ == "__main__":
    asyncio.run(main())
