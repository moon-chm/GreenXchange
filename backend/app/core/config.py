from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    POSTGRES_USER: str = "greenxchange"
    POSTGRES_PASSWORD: str = "supersecret"
    POSTGRES_DB: str = "greenxchange"
    DATABASE_URL: str = "postgresql://greenxchange:supersecret@localhost:5432/greenxchange"
    
    REDIS_URL: str = "redis://localhost:6379/0"
    
    MINIO_ENDPOINT: str = ""
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin123"
    MINIO_SECURE: bool = False
    
    SECRET_KEY: str = "greenxchange-production-secret-key-change-later-32chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    JWT_PRIVATE_KEY_B64: str = ""
    JWT_PUBLIC_KEY_B64: str = ""
    GROQ_API_KEY: str = ""
    GROQ_CARE_API_KEY: str = ""
    
    # Email — official production configuration with fallback
    EMAIL_PROVIDER: str = "smtp"
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = "gogreenxchange.official@gmail.com"
    SMTP_PASSWORD: str = "nqyapxpfmrmpzbex"
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "GreenXchange <gogreenxchange.official@gmail.com>"
    FRONTEND_URL: str = "https://greenxchange-frontend.onrender.com"

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
    
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding='utf-8', extra='ignore')

settings = Settings()
