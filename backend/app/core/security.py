from datetime import datetime, timedelta, timezone
from typing import Any, Union
from jose import jwt
from app.core.config import settings
import uuid
import bcrypt

def _get_signing_key_and_algo():
    key = settings.jwt_private_key
    algo = settings.ALGORITHM
    if not key or not key.strip() or algo == "HS256":
        return settings.SECRET_KEY, "HS256"
    return key, algo

def create_access_token(subject: Union[str, Any], expires_delta: timedelta = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"exp": expire, "sub": str(subject), "type": "access"}
    key, algo = _get_signing_key_and_algo()
    encoded_jwt = jwt.encode(to_encode, key, algorithm=algo)
    return encoded_jwt

def create_refresh_token(subject: Union[str, Any], jti: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode = {"exp": expire, "sub": str(subject), "jti": jti, "type": "refresh"}
    key, algo = _get_signing_key_and_algo()
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
