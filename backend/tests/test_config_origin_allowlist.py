"""
settings.is_allowed_origin() gates which Origin/Referer values auth.py will
trust when building password-reset/verification links (see app/api/auth.py's
_get_request_base_url). A regression here is a direct phishing/account-
takeover vector, so it gets its own focused tests.
"""
from app.core.config import settings


def test_accepts_configured_frontend_url():
    assert settings.is_allowed_origin(settings.FRONTEND_URL) is True


def test_accepts_greenxchange_onrender_subdomains():
    assert settings.is_allowed_origin("https://greenxchange-frontend.onrender.com") is True
    assert settings.is_allowed_origin("https://greenxchange-staging.onrender.com") is True


def test_accepts_localhost_dev_origins():
    assert settings.is_allowed_origin("http://localhost:3000") is True
    assert settings.is_allowed_origin("http://127.0.0.1:3000") is True
    assert settings.is_allowed_origin("http://localhost:8000") is True


def test_rejects_unrelated_domain():
    assert settings.is_allowed_origin("https://evil.com") is False


def test_rejects_domain_suffix_bypass_attempt():
    # "https://greenxchange-frontend.onrender.com.evil.com" starts with an
    # allowed-looking prefix but is a completely different domain — a regex
    # without a trailing anchor would wrongly accept this.
    assert settings.is_allowed_origin("https://greenxchange-frontend.onrender.com.evil.com") is False


def test_rejects_lookalike_domain_without_dash():
    assert settings.is_allowed_origin("https://notgreenxchange.onrender.com.attacker.io") is False


def test_rejects_empty_or_none():
    assert settings.is_allowed_origin("") is False
    assert settings.is_allowed_origin(None) is False


def test_trailing_slash_is_normalized():
    assert settings.is_allowed_origin("http://localhost:3000/") is True
