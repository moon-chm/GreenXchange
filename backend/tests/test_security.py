"""
JWT + password hashing behavior — the core of every authenticated request.
"""
from datetime import timedelta

import pytest
from jose import JWTError

from app.core import security


def test_password_hash_roundtrip():
    hashed = security.get_password_hash("correct horse battery staple")
    assert hashed != "correct horse battery staple"
    assert security.verify_password("correct horse battery staple", hashed) is True
    assert security.verify_password("wrong password", hashed) is False


def test_verify_password_never_raises_on_garbage_hash():
    # A malformed/legacy hash must fail closed, not throw past the caller.
    assert security.verify_password("anything", "not-a-real-bcrypt-hash") is False


def test_access_token_roundtrip():
    token = security.create_access_token(subject="user-123")
    payload = security.decode_token(token)
    assert payload["sub"] == "user-123"
    assert payload["type"] == "access"


def test_refresh_token_carries_jti_and_type():
    token = security.create_refresh_token(subject="user-456", jti="jti-789")
    payload = security.decode_token(token)
    assert payload["sub"] == "user-456"
    assert payload["type"] == "refresh"
    assert payload["jti"] == "jti-789"


def test_expired_token_fails_to_decode():
    token = security.create_access_token(subject="user-1", expires_delta=timedelta(seconds=-1))
    with pytest.raises(JWTError):
        security.decode_token(token)


def test_tampered_token_fails_to_decode():
    token = security.create_access_token(subject="user-1")
    tampered = token[:-1] + ("A" if token[-1] != "A" else "B")
    with pytest.raises(JWTError):
        security.decode_token(tampered)
