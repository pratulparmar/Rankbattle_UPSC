
from pydantic_settings import BaseSettings
class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:TzkcmJIkHZrKZljfaGaQcKhBZHuwfkcr@hopper.proxy.rlwy.net:47135/railway"
    SECRET_KEY: str = "rankbattle-super-secret-2026-upsc"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
settings = Settings()
