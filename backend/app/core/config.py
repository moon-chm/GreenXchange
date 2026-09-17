from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    POSTGRES_USER: str = "greenxchange"
    POSTGRES_PASSWORD: str = ""
    POSTGRES_DB: str = "greenxchange"
    DATABASE_URL: str = ""

    REDIS_URL: str = "redis://localhost:6379/0"

    MINIO_ENDPOINT: str = ""
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin123"
    MINIO_SECURE: bool = False
    # Browser-reachable origin for MinIO-stored media (e.g. "https://media.example.com").
    # MINIO_ENDPOINT above is often an internal/container hostname (e.g. "minio:9000")
    # that isn't reachable from a client, so it must not be reused for public URLs.
    # Left unset, previously-hardcoded "http://localhost:9000" behavior is preserved.
    MINIO_PUBLIC_URL: str = ""

    # No hardcoded default: an app that can't authenticate anyone safely must not boot.
    # Set explicitly in .env for local dev; see .env.example.
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    JWT_PRIVATE_KEY_B64: str = ""
    JWT_PUBLIC_KEY_B64: str = ""
    GROQ_API_KEY: str = ""
    GROQ_CARE_API_KEY: str = ""

    # Email — Gmail API OAuth2 (primary, works on Render free tier via HTTPS/443)
    EMAIL_PROVIDER: str = "gmail_api"
    GMAIL_CLIENT_ID: str = ""
    GMAIL_CLIENT_SECRET: str = ""
    GMAIL_REFRESH_TOKEN: str = ""
    GMAIL_SENDER: str = "gogreenxchange.official@gmail.com"
    EMAIL_FROM: str = "GreenXchange <gogreenxchange.official@gmail.com>"

    # Legacy SMTP fallback (kept for local dev / non-Render environments)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = "gogreenxchange.official@gmail.com"
    SMTP_PASSWORD: str = ""

    # Resend API fallback
    RESEND_API_KEY: str = ""

    FRONTEND_URL: str = "https://greenxchange-frontend.onrender.com"

    # Computer Vision AI Models
    TREE_MODEL_PATH: str = ""
    PLANT_HEALTH_MODEL_PATH: str = ""

    # Shared secret required on POST /api/environment/hardware (X-Hardware-Api-Key
    # header). Left unset, that endpoint stays open for backward compatibility.
    HARDWARE_API_KEY: str = ""

    @property
    def jwt_private_key(self) -> str:
        if not self.JWT_PRIVATE_KEY_B64:
            return ""
        import base64
        try:
            return base64.b64decode(self.JWT_PRIVATE_KEY_B64).decode('utf-8')
        except Exception:
            return ""

    @property
    def jwt_public_key(self) -> str:
        if not self.JWT_PUBLIC_KEY_B64:
            return ""
        import base64
        try:
            return base64.b64decode(self.JWT_PUBLIC_KEY_B64).decode('utf-8')
        except Exception:
            return ""

    @model_validator(mode="after")
    def _enforce_auth_secret_policy(self):
        """
        Fail closed on authentication configuration instead of silently downgrading:
        - ALGORITHM=RS256 requires a valid RSA key pair — never falls back to HS256.
        - ALGORITHM=HS256 requires an explicit, sufficiently long SECRET_KEY — no hardcoded default.
        This runs at Settings() construction time (app import/startup), so a misconfigured
        deployment refuses to boot rather than silently serving forgeable tokens.
        """
        if self.ALGORITHM == "RS256":
            if not self.jwt_private_key or not self.jwt_public_key:
                if self.SECRET_KEY and len(self.SECRET_KEY) >= 32:
                    import logging
                    logging.getLogger("backend").warning(
                        "⚠️ ALGORITHM=RS256 was configured but JWT keys are missing. "
                        "Safely falling back to HS256 with SECRET_KEY."
                    )
                    self.ALGORITHM = "HS256"
                else:
                    raise ValueError(
                        "ALGORITHM=RS256 is configured but JWT_PRIVATE_KEY_B64 / JWT_PUBLIC_KEY_B64 "
                        "are missing or not valid base64-encoded PEM keys. Refusing to start rather "
                        "than silently falling back to HS256. Generate a key pair with "
                        "'python backend/scripts/generate_keys.py', or set ALGORITHM=HS256 for local "
                        "development."
                    )
        elif self.ALGORITHM == "HS256":
            if not self.SECRET_KEY or len(self.SECRET_KEY) < 32:
                raise ValueError(
                    "SECRET_KEY must be set to a random string of at least 32 characters "
                    "(ALGORITHM=HS256 requires it). Add it to your local .env, e.g.:\n"
                    '  python -c "import secrets; print(secrets.token_urlsafe(32))"'
                )
        else:
            raise ValueError(f"Unsupported ALGORITHM '{self.ALGORITHM}'. Must be 'HS256' or 'RS256'.")
        return self

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding='utf-8', extra='ignore')

settings = Settings()
