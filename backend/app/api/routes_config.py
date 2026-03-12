from fastapi import APIRouter

from app.config import settings
from app.schemas.rota import ConfigResponse

router = APIRouter(tags=["config"])


@router.get("/config", response_model=ConfigResponse)
def get_config():
    return ConfigResponse(city=settings.CITY)
