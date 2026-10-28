import asyncio
from logging.config import fileConfig

from sqlalchemy import pool, inspect, text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

from app.core.config import settings

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
from app.models.base import Base
import app.models  # Ensure all models are loaded
target_metadata = Base.metadata

import urllib.parse

# Set the sqlalchemy url from our app settings
db_url = settings.DATABASE_URL
if db_url:
    parsed = urllib.parse.urlparse(db_url)
    query_dict = urllib.parse.parse_qs(parsed.query)

    # Preserve TLS for hosted databases while allowing local Docker Postgres.
    hostname = (parsed.hostname or "").lower()
    use_ssl = hostname not in {"", "localhost", "127.0.0.1", "::1", "db", "postgres"}
    if query_dict.get("sslmode", [""])[0].lower() in {"require", "verify-ca", "verify-full"}:
        use_ssl = True

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

config.set_main_option("sqlalchemy.url", db_url)


def include_object(object, name, type_, reflected, compare_to):
    if type_ == "table" and name not in target_metadata.tables:
        return False
    return True

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    # Earlier releases attempted Alembic before `Base.metadata.create_all()`
    # and ignored migration errors. If that left a complete legacy schema with
    # no Alembic version table, record the already-present baseline and let the
    # new forward migration repair it instead of trying to recreate live tables.
    inspector = inspect(connection)
    has_version_table = inspector.has_table("alembic_version")
    has_version_rows = has_version_table and connection.execute(text("SELECT version_num FROM alembic_version LIMIT 1")).first() is not None
    if not has_version_rows and inspector.has_table("users"):
        baseline_tables = {
            "environmental_profiles", "news_feed_items", "plant_species", "users",
            "community_drives", "plants", "drive_participations", "growth_updates",
            "reward_transactions",
        }
        existing_tables = set(inspector.get_table_names())
        if baseline_tables.issubset(existing_tables):
            if not has_version_table:
                connection.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"))
            connection.execute(text("INSERT INTO alembic_version (version_num) VALUES (:revision), (:revision2)"), {
                "revision": "fix_is_active_default_false",
                "revision2": "6f001aedd7d4",
            })

    context.configure(
        connection=connection, 
        target_metadata=target_metadata,
        include_object=include_object
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connect_args = {"ssl": "require"} if use_ssl else {}
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args=connect_args,
    )

    # Start the transaction before do_run_migrations() inspects the schema.
    # Those inspection queries autobegin a transaction; an externally managed
    # transaction ensures Alembic's DDL and version updates are committed when
    # this context exits instead of being rolled back on connection close.
    async with connectable.begin() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""

    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
