import os
import json
from typing import List
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

try:
    from dotenv import load_dotenv
    for env_candidate in (BASE_DIR / ".env", BASE_DIR.parent / ".env", Path.home() / ".env"):
        if env_candidate.exists():
            load_dotenv(env_candidate, override=False)
except ImportError:
    pass


class Settings:
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEMO_MODE: bool = os.getenv("DEMO_MODE", "true").lower() in ("true", "1", "yes")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "pulpi-ai-super-secret-key-change-in-production")
    DB_PATH: str = os.getenv("DB_PATH", str(BASE_DIR / "pulpi.db"))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))

    # Gemini AI Configuration
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", os.getenv("GOOGLE_API_KEY", ""))
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")

    # Demo user credentials (fictitious test account)
    DEMO_USER_EMAIL: str = "maria@gmail.com"
    DEMO_USER_PHONE: str = "976345234"
    DEMO_USER_PASSWORD: str = "comerciante123"
    DEMO_USER_NAME: str = "María Rodríguez"
    DEMO_USER_BUSINESS: str = "Bodega Mi Esquina"

    @property
    def cors_origins(self) -> List[str]:
        raw = os.getenv("CORS_ORIGINS", '["*"]')
        try:
            return json.loads(raw)
        except Exception:
            return ["*"]


settings = Settings()
