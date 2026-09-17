import urllib.parse
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

db_url = settings.DATABASE_URL
use_ssl = False

if db_url:
    parsed = urllib.parse.urlparse(db_url)
    query_dict = urllib.parse.parse_qs(parsed.query)

    use_ssl = (
        "sslmode" in query_dict or
        "neon.tech" in parsed.netloc or
        ".render.com" in parsed.netloc or
        "onrender.com" in parsed.netloc
    )

    # Strip parameters not understood by asyncpg
    for param in ["sslmode", "channel_binding"]:
        query_dict.pop(param, None)

    new_query = urllib.parse.urlencode(query_dict, doseq=True)
    scheme = parsed.scheme
    if scheme in ("postgres", "postgresql", "postgresql+psycopg2"):
        scheme = "postgresql+asyncpg"

    db_url = urllib.parse.urlunparse((
        scheme,
        parsed.netloc,
        parsed.path,
        parsed.params,
        new_query,
        parsed.fragment
    ))

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
