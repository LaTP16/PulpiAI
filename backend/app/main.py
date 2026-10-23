from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.database.session import init_db
from app.database.seed_data import seed_demo_data_if_needed
from app.api.auth_router import router as auth_router
from app.api.transactions_router import router as transactions_router
from app.api.voice_router import router as voice_router
from app.api.ocr_router import router as ocr_router
from app.api.assistant_router import router as assistant_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize database tables and seed demo account/data
    init_db()
    if settings.DEMO_MODE:
        seed_demo_data_if_needed()
    yield

app = FastAPI(
    title="PulpiAI Financial API",
    description="Asistente de IA por voz e imagen que digitaliza ingresos y gastos de pequeños negocios informales para ordenar sus finanzas y facilitar su acceso al crédito.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth_router, prefix="/api")
app.include_router(transactions_router, prefix="/api")
app.include_router(voice_router, prefix="/api")
app.include_router(ocr_router, prefix="/api")
app.include_router(assistant_router, prefix="/api")

@app.get("/")
def root():
    return {
        "service": "PulpiAI Backend",
        "status": "healthy",
        "docs": "/docs",
        "health": "/api/health"
    }

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "PulpiAI Backend",
        "demo_mode": settings.DEMO_MODE,
        "environment": settings.ENVIRONMENT
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
