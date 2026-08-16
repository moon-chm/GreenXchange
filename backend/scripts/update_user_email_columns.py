import asyncio
from sqlalchemy import text
from app.db.session import engine

async def update_schema():
    print("🔄 Updating users table schema with email verification & password reset columns...")
    async with engine.begin() as conn:
        # Add columns if not exists
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255);"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMPTZ;"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255);"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ;"))
        
        # Create indexes
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_users_email_verification_token ON users (email_verification_token);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_users_password_reset_token ON users (password_reset_token);"))
        
        # Mark all existing users as verified and active so their accounts remain working seamlessly
        await conn.execute(text("UPDATE users SET email_verified = TRUE, is_active = TRUE WHERE email_verified IS NULL OR email_verified = FALSE;"))
        
    print("✅ Users table updated with email fields successfully!")

if __name__ == "__main__":
    asyncio.run(update_schema())
