"""
Test env setup — must run before any `app.*` module is imported, since
app.core.config.Settings() validates auth config eagerly at import time
(fails fast if SECRET_KEY is missing/short — see _enforce_auth_secret_policy).
pytest imports conftest.py before collecting test modules in the same
directory, so these env vars are guaranteed to be set first.

No real Postgres/Redis is required for the current test suite — it only
covers pure-logic pieces (JWT, origin allowlist, rate limiter against an
in-memory fake). DATABASE_URL/REDIS_URL below are just well-formed enough for
Settings()/module-level client construction to succeed; nothing here opens an
actual connection.
"""
import os

os.environ.setdefault("SECRET_KEY", "test-only-secret-key-do-not-use-in-prod-32chars")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
