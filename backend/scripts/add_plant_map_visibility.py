import asyncio
from sqlalchemy import text
from app.db.session import engine

async def migrate():
    print("🔄 Adding 'is_public_on_map' column to 'plants' table in PostgreSQL...")
    async with engine.begin() as conn:
        await conn.execute(text("ALTER TABLE plants ADD COLUMN IF NOT EXISTS is_public_on_map BOOLEAN DEFAULT TRUE;"))
        await conn.execute(text("UPDATE plants SET is_public_on_map = TRUE WHERE is_public_on_map IS NULL;"))
    print("✅ Plants table updated with map visibility column successfully!")

if __name__ == "__main__":
    asyncio.run(migrate())
