"""
Login lockout + refresh-token blocklist behavior, against an in-memory fake
Redis (no real Redis needed). Covers the logout/refresh blocklist wiring
added to close the "logout doesn't actually revoke the refresh token" gap.
"""
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import app.core.rate_limiter as rl


class FakeRedis:
    """Minimal async stand-in for the subset of redis-py's API rate_limiter.py uses."""

    def __init__(self):
        self.store: dict[str, str] = {}

    async def get(self, key):
        return self.store.get(key)

    async def setex(self, key, ttl, value):
        self.store[key] = value

    async def incr(self, key):
        current = int(self.store.get(key, 0)) + 1
        self.store[key] = str(current)
        return current

    async def expire(self, key, ttl):
        pass

    async def delete(self, key):
        self.store.pop(key, None)


def _make_request(ip: str = "1.2.3.4"):
    return SimpleNamespace(
        headers=SimpleNamespace(get=lambda key, default=None: default),
        client=SimpleNamespace(host=ip),
    )


@pytest.fixture
def fake_redis(monkeypatch):
    fr = FakeRedis()
    monkeypatch.setattr(rl, "redis_client", fr)
    return fr


@pytest.mark.asyncio
async def test_check_rate_limit_allows_fresh_ip(fake_redis):
    await rl.check_rate_limit(_make_request("10.0.0.1"))  # must not raise


@pytest.mark.asyncio
async def test_lockout_after_max_failed_attempts(fake_redis):
    req = _make_request("10.0.0.2")
    for _ in range(rl.MAX_FAILED_ATTEMPTS):
        await rl.record_failed_attempt(req)

    with pytest.raises(HTTPException) as exc_info:
        await rl.check_rate_limit(req)
    assert exc_info.value.status_code == 429


@pytest.mark.asyncio
async def test_below_threshold_does_not_lock_out(fake_redis):
    req = _make_request("10.0.0.3")
    for _ in range(rl.MAX_FAILED_ATTEMPTS - 1):
        await rl.record_failed_attempt(req)

    await rl.check_rate_limit(req)  # must not raise yet


@pytest.mark.asyncio
async def test_clear_failed_attempts_resets_counter(fake_redis):
    req = _make_request("10.0.0.4")
    await rl.record_failed_attempt(req)
    await rl.clear_failed_attempts(req)
    assert fake_redis.store.get("attempts:10.0.0.4") is None


@pytest.mark.asyncio
async def test_blocklist_token_roundtrip(fake_redis):
    jti = "some-refresh-token-jti"
    assert await rl.is_token_blocklisted(jti) is False

    await rl.blocklist_token(jti, expires_in_days=1)

    assert await rl.is_token_blocklisted(jti) is True


@pytest.mark.asyncio
async def test_different_jti_is_not_blocklisted(fake_redis):
    await rl.blocklist_token("jti-a", expires_in_days=1)
    assert await rl.is_token_blocklisted("jti-b") is False
