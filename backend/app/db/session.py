from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.core.config import settings

# Ensure we use asyncpg for FastAPI
db_url = settings.DATABASE_URL

# Normalize driver: asyncpg is used for async FastAPI sessions
if db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
elif db_url.startswith("postgresql+psycopg2://"):
    db_url = db_url.replace("postgresql+psycopg2://", "postgresql+asyncpg://", 1)

# asyncpg does not understand sslmode=require as a query param;
# strip it and pass ssl via connect_args instead.
use_ssl = False
if "sslmode=require" in db_url:
    db_url = db_url.replace("?sslmode=require", "").replace("&sslmode=require", "")
    use_ssl = True

connect_args = {"ssl": "require"} if use_ssl else {}

engine = create_async_engine(db_url, echo=False, connect_args=connect_args)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

