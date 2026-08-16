from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

db_url = settings.DATABASE_URL

# Render PostgreSQL uses postgres:// prefix — normalize to postgresql://
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# Normalize driver to asyncpg for FastAPI async sessions
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

# Render internal DB connections need SSL
if ".render.com" in db_url or "onrender.com" in db_url:
    use_ssl = True

connect_args = {"ssl": "require"} if use_ssl else {}

logger.info(f"Database engine initialized (ssl={'enabled' if use_ssl else 'disabled'})")

engine = create_async_engine(
    db_url,
    echo=False,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,  # Verify connections before using them
    connect_args=connect_args
)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
