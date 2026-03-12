"""Holiday API endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.db.session import get_db
from app.schemas.rota import HolidaysResponse
from app.services.holidays import get_holidays

router = APIRouter(prefix="/holidays", tags=["holidays"])


@router.get("/{year}", response_model=HolidaysResponse)
def get_holidays_endpoint(year: int, db: Session = Depends(get_db)):
    """Return holidays for the configured city and given year."""
    city = settings.CITY
    try:
        holidays = get_holidays(year, city, db)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Holiday API error: {e}")

    return HolidaysResponse(year=year, city=city, holidays=holidays)
