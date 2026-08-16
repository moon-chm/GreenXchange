import asyncio
from sqlalchemy import text
from app.db.session import engine

async def update_schema():
    async with engine.begin() as conn:
        print("Updating users table schema for org roles...")
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'USER' NOT NULL;"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_org BOOLEAN DEFAULT FALSE NOT NULL;"))
        print("✅ users table schema updated with role & is_org columns!")

if __name__ == "__main__":
    asyncio.run(update_schema())
