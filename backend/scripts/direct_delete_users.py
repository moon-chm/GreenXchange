import asyncio
from sqlalchemy import text
from app.db.session import engine

async def direct_delete():
    async with engine.begin() as conn:
        result = await conn.execute(text("""
            DELETE FROM users 
            WHERE email ILIKE '%salokhe%' OR email ILIKE '%harshad%' OR email ILIKE '%fagare%'
            RETURNING id, name, email;
        """))
        deleted_rows = result.fetchall()
        print(f"✅ Successfully deleted {len(deleted_rows)} user(s):")
        for row in deleted_rows:
            print(f"   - {row[1]} ({row[2]}) [ID: {row[0]}]")

if __name__ == "__main__":
    asyncio.run(direct_delete())
