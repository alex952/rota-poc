from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes_config import router as config_router
from app.api.routes_holidays import router as holidays_router
from app.api.routes_rota import router as rota_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic (e.g. DB connection pool) can go here
    yield
    # Shutdown logic can go here


app = FastAPI(
    title="Doctor Rota Assignment API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow all origins for PoC
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(config_router, prefix="/api/v1")
app.include_router(rota_router, prefix="/api/v1")
app.include_router(holidays_router, prefix="/api/v1")


@app.get("/health")
def health_check():
    return {"status": "ok"}
