from datetime import datetime, timedelta, timezone
from typing import Any, Union, Tuple
from jose import jwt
from app.core.config import settings
import uuid
import bcrypt


def get_signing_key_and_algo() -> Tuple[str, str]:
    """
    Key + algorithm used to SIGN new tokens. Always matches settings.ALGORITHM exactly —
    never substitutes HS256 when RS256 is configured. Settings' own startup validator
    (app/core/config.py) already guarantees the required key material exists by the time
    the app is serving requests; the checks here are defense-in-depth, not the primary gate.
    """
    if settings.ALGORITHM == "RS256":
        key = settings.jwt_private_key
        if not key:
            raise RuntimeError("ALGORITHM=RS256 but no valid JWT private key is configured.")
        return key, "RS256"
    if settings.ALGORITHM == "HS256":
        if not settings.SECRET_KEY:
            raise RuntimeError("ALGORITHM=HS256 but SECRET_KEY is not configured.")
        return settings.SECRET_KEY, "HS256"
    raise RuntimeError(f"Unsupported ALGORITHM '{settings.ALGORITHM}'.")


def get_verifying_key_and_algo() -> Tuple[str, str]:
    """
    Key + algorithm used to VERIFY tokens. Mirrors get_signing_key_and_algo() — the same
    algorithm settings.ALGORITHM declares, every time. Never falls back to HS256 just
    because a public key string happens to be blank.
    """
    if settings.ALGORITHM == "RS256":
        key = settings.jwt_public_key
        if not key:
            raise RuntimeError("ALGORITHM=RS256 but no valid JWT public key is configured.")
        return key, "RS256"
    if settings.ALGORITHM == "HS256":
        if not settings.SECRET_KEY:
            raise RuntimeError("ALGORITHM=HS256 but SECRET_KEY is not configured.")
        return settings.SECRET_KEY, "HS256"
    raise RuntimeError(f"Unsupported ALGORITHM '{settings.ALGORITHM}'.")


def decode_token(token: str) -> dict:
    """Single source of truth for verifying any JWT issued by this app (access or refresh)."""
    key, algo = get_verifying_key_and_algo()
    return jwt.decode(token, key, algorithms=[algo])


def create_access_token(subject: Union[str, Any], expires_delta: timedelta = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"exp": expire, "sub": str(subject), "type": "access"}
    key, algo = get_signing_key_and_algo()
    encoded_jwt = jwt.encode(to_encode, key, algorithm=algo)
    return encoded_jwt

def create_refresh_token(subject: Union[str, Any], jti: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode = {"exp": expire, "sub": str(subject), "jti": jti, "type": "refresh"}
    key, algo = get_signing_key_and_algo()
    encoded_jwt = jwt.encode(to_encode, key, algorithm=algo)
    return encoded_jwt

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
