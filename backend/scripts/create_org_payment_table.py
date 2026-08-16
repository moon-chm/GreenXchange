import asyncio
from sqlalchemy import text
from app.db.session import engine
from app.models.base import Base
import app.models.rewards

async def create_tables():
    async with engine.begin() as conn:
        print("Creating org_payment_requests table if not exists...")
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS org_payment_requests (
                id UUID PRIMARY KEY,
                org_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                amount_gxc INTEGER NOT NULL,
                service_description VARCHAR(255) NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                processed_at TIMESTAMP WITH TIME ZONE
            );
        """))
        print("✅ org_payment_requests table ready!")

if __name__ == "__main__":
    asyncio.run(create_tables())
