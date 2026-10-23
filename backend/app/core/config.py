import os
import json
from typing import List
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings:
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEMO_MODE: bool = os.getenv("DEMO_MODE", "true").lower() in ("true", "1", "yes")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "kipu-ai-super-secret-key-change-in-production")
    DB_PATH: str = os.getenv("DB_PATH", str(BASE_DIR / "kipu.db"))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))

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
