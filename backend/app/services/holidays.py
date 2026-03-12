"""Holiday service — fetch & cache Spanish holidays, classify days."""

import datetime
from datetime import date, timedelta

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.models.db_models import Holiday
from app.schemas.rota import DayInfo, HolidayItem

# Mapping of city names (lowercase) to ISO 3166-2:ES region codes.
# The API returns national holidays (global=True, counties=null) and
# regional holidays scoped to specific autonomous communities via the
# "counties" field. We only keep holidays that are national OR belong
# to the region of the configured city.
CITY_TO_REGION: dict[str, str] = {
    "madrid": "ES-MD",
    "barcelona": "ES-CT",
    "valencia": "ES-VC",
    "alicante": "ES-VC",
    "sevilla": "ES-AN",
    "seville": "ES-AN",
    "malaga": "ES-AN",
    "bilbao": "ES-PV",
    "san sebastian": "ES-PV",
    "zaragoza": "ES-AR",
    "murcia": "ES-MC",
    "palma": "ES-IB",
    "las palmas": "ES-CN",
    "santa cruz de tenerife": "ES-CN",
    "valladolid": "ES-CL",
    "vigo": "ES-GA",
    "santiago de compostela": "ES-GA",
    "oviedo": "ES-AS",
    "santander": "ES-CB",
    "pamplona": "ES-NC",
    "logrono": "ES-RI",
    "toledo": "ES-CM",
    "caceres": "ES-EX",
    "badajoz": "ES-EX",
    "girona": "ES-CT",
    "tarragona": "ES-CT",
    "castellon": "ES-VC",
    "cordoba": "ES-AN",
    "granada": "ES-AN",
    "cadiz": "ES-AN",
    "huelva": "ES-AN",
    "jaen": "ES-AN",
    "almeria": "ES-AN",
    "ceuta": "ES-CE",
    "melilla": "ES-ML",
}


def _is_holiday_for_city(holiday: dict, region_code: str | None) -> bool:
    """Check if a holiday from the API applies to the configured city.

    A holiday applies if:
    - It is global (national holiday, counties is null) OR
    - Its counties list includes the city's region code
    """
    if holiday.get("global", False):
        return True
    counties = holiday.get("counties")
    if counties is None:
        return True
    if region_code and region_code in counties:
        return True
    return False


def fetch_holidays(year: int, city: str, db: Session) -> list[HolidayItem]:
    """Fetch holidays from the date.nager.at API and cache them in the DB.

    Only keeps national holidays and regional holidays matching the city's
    autonomous community. Raises an exception if the API is unavailable.
    """
    url = f"{settings.HOLIDAY_API_URL}/PublicHolidays/{year}/ES"
    response = httpx.get(url, timeout=15.0)
    response.raise_for_status()

    raw_holidays = response.json()
    region_code = CITY_TO_REGION.get(city.lower())

    items: list[HolidayItem] = []
    seen_dates: set[date] = set()
    for h in raw_holidays:
        if not _is_holiday_for_city(h, region_code):
            continue

        holiday_date = date.fromisoformat(h["date"])
        if holiday_date in seen_dates:
            continue
        seen_dates.add(holiday_date)

        local_name = h.get("localName") or h.get("name", "")
        items.append(HolidayItem(date=holiday_date, name=local_name))

        # Persist to DB (cache)
        existing = (
            db.query(Holiday)
            .filter_by(year=year, city=city, date=holiday_date)
            .first()
        )
        if not existing:
            db.add(
                Holiday(
                    year=year,
                    city=city,
                    date=holiday_date,
                    name=local_name,
                )
            )

    db.commit()
    return items


def get_holidays(year: int, city: str, db: Session) -> list[HolidayItem]:
    """Get holidays from cache (DB) or fetch from API if not cached."""
    cached = db.query(Holiday).filter_by(year=year, city=city).all()
    if cached:
        return [HolidayItem(date=h.date, name=h.name) for h in cached]

    return fetch_holidays(year, city, db)


def classify_day(
    d: date, holidays: set[date]
) -> tuple[str, int, str, str]:
    """Classify a single day.

    Returns (day_type, duration_hours, shift_start, shift_end).

    Precedence: holiday > saturday > weekday.
    Sunday is always 'holiday'.
    """
    weekday = d.weekday()  # 0=Mon, 5=Sat, 6=Sun

    if d in holidays or weekday == 6:
        # Holiday or Sunday → 23h shift
        return ("holiday", 23, "09:00", "08:00+1")
    elif weekday == 5:
        # Saturday (non-holiday) → 18h shift
        return ("saturday", 18, "15:00", "09:00+1")
    else:
        # Weekday → 17h shift
        return ("weekday", 17, "15:00", "08:00+1")


def classify_year(year: int, holidays: set[date]) -> list[DayInfo]:
    """Classify every day in the given year."""
    start = date(year, 1, 1)
    end = date(year, 12, 31)
    days: list[DayInfo] = []
    current = start
    while current <= end:
        day_type, duration, shift_start, shift_end = classify_day(current, holidays)
        days.append(
            DayInfo(
                date=current,
                day_type=day_type,
                duration_hours=duration,
                shift_start=shift_start,
                shift_end=shift_end,
            )
        )
        current += timedelta(days=1)
    return days
