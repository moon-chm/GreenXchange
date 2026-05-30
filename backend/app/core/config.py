from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    POSTGRES_USER: str = "greenxchange"
    POSTGRES_PASSWORD: str = "supersecret"
    POSTGRES_DB: str = "greenxchange"
    DATABASE_URL: str
    
    REDIS_URL: str
    
    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin123"
    MINIO_SECURE: bool = False
    
    SECRET_KEY: str = "secret"
    ALGORITHM: str = "RS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    JWT_PRIVATE_KEY_B64: str = ""
    JWT_PUBLIC_KEY_B64: str = ""
    
    @property
    def jwt_private_key(self) -> str:
        if not self.JWT_PRIVATE_KEY_B64:
            return ""
        import base64
        return base64.b64decode(self.JWT_PRIVATE_KEY_B64).decode('utf-8')
        
    @property
    def jwt_public_key(self) -> str:
        if not self.JWT_PUBLIC_KEY_B64:
            return ""
        import base64
        return base64.b64decode(self.JWT_PUBLIC_KEY_B64).decode('utf-8')
    
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding='utf-8', extra='ignore')

settings = Settings()
