"""Tests for the holiday service — Phase 2.

Covers PRD acceptance criteria AC-3.4.1 through AC-3.4.4.
"""

import datetime
from unittest.mock import MagicMock, patch

import pytest

from app.models.db_models import Holiday
from app.schemas.rota import HolidayItem
from app.services.holidays import (
    classify_day,
    classify_year,
    fetch_holidays,
    get_holidays,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

SAMPLE_API_RESPONSE = [
    {
        "date": "2026-01-01",
        "localName": "Ano Nuevo",
        "name": "New Year's Day",
        "countryCode": "ES",
        "fixed": True,
        "global": True,
        "counties": None,
        "launchYear": None,
        "types": ["Public"],
    },
    {
        "date": "2026-01-06",
        "localName": "Dia de Reyes",
        "name": "Epiphany",
        "countryCode": "ES",
        "fixed": True,
        "global": True,
        "counties": None,
        "launchYear": None,
        "types": ["Public"],
    },
    {
        "date": "2026-05-01",
        "localName": "Dia del Trabajador",
        "name": "Labour Day",
        "countryCode": "ES",
        "fixed": True,
        "global": True,
        "counties": None,
        "launchYear": None,
        "types": ["Public"],
    },
]

# Includes national, Madrid-regional, and Catalonia-regional holidays
SAMPLE_API_RESPONSE_WITH_REGIONS = [
    {
        "date": "2026-01-01",
        "localName": "Ano Nuevo",
        "name": "New Year's Day",
        "countryCode": "ES",
        "fixed": True,
        "global": True,
        "counties": None,
        "types": ["Public"],
    },
    {
        "date": "2026-03-19",
        "localName": "San Jose",
        "name": "St. Joseph's Day",
        "countryCode": "ES",
        "fixed": True,
        "global": False,
        "counties": ["ES-VC", "ES-MC"],
        "types": ["Public"],
    },
    {
        "date": "2026-04-23",
        "localName": "Sant Jordi",
        "name": "St. George's Day",
        "countryCode": "ES",
        "fixed": True,
        "global": False,
        "counties": ["ES-CT"],
        "types": ["Public"],
    },
    {
        "date": "2026-05-02",
        "localName": "Dia de la Comunidad de Madrid",
        "name": "Madrid Day",
        "countryCode": "ES",
        "fixed": True,
        "global": False,
        "counties": ["ES-MD"],
        "types": ["Public"],
    },
]


# ---------------------------------------------------------------------------
# AC-3.4.1: Fetch returns national and regional holidays
# ---------------------------------------------------------------------------


def test_fetch_holidays_returns_national_and_regional(db_session):
    """Mock the external API call and verify holidays are returned."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = SAMPLE_API_RESPONSE
    mock_response.raise_for_status = MagicMock()

    with patch("app.services.holidays.httpx.get", return_value=mock_response):
        holidays = fetch_holidays(2026, "Madrid", db_session)

    assert len(holidays) == 3
    assert holidays[0].date == datetime.date(2026, 1, 1)
    assert holidays[0].name == "Ano Nuevo"
    assert holidays[1].date == datetime.date(2026, 1, 6)
    assert holidays[2].date == datetime.date(2026, 5, 1)


# ---------------------------------------------------------------------------
# AC-3.4.2: Holidays cached in database
# ---------------------------------------------------------------------------


def test_holidays_cached_in_database(db_session):
    """After first fetch, holidays are stored in DB. Second call reads from DB."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = SAMPLE_API_RESPONSE
    mock_response.raise_for_status = MagicMock()

    with patch("app.services.holidays.httpx.get", return_value=mock_response) as mock_get:
        # First call — fetches from API
        holidays_1 = get_holidays(2026, "Madrid", db_session)
        assert mock_get.call_count == 1

        # Second call — should read from DB, NOT hit API again
        holidays_2 = get_holidays(2026, "Madrid", db_session)
        assert mock_get.call_count == 1  # still 1

    assert len(holidays_1) == len(holidays_2)
    # Verify actually stored in DB
    db_holidays = db_session.query(Holiday).filter_by(year=2026, city="Madrid").all()
    assert len(db_holidays) == 3


# ---------------------------------------------------------------------------
# Regional filtering: only national + city's region holidays are kept
# ---------------------------------------------------------------------------


def test_fetch_holidays_filters_by_city_region(db_session):
    """Only national and holidays for the city's autonomous community are returned."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = SAMPLE_API_RESPONSE_WITH_REGIONS
    mock_response.raise_for_status = MagicMock()

    # Madrid should get: Ano Nuevo (global) + Dia de la Comunidad de Madrid (ES-MD)
    # Should NOT get: San Jose (ES-VC, ES-MC) or Sant Jordi (ES-CT)
    with patch("app.services.holidays.httpx.get", return_value=mock_response):
        holidays = fetch_holidays(2026, "Madrid", db_session)

    names = [h.name for h in holidays]
    assert "Ano Nuevo" in names
    assert "Dia de la Comunidad de Madrid" in names
    assert "San Jose" not in names
    assert "Sant Jordi" not in names
    assert len(holidays) == 2


def test_fetch_holidays_filters_for_valencia_region(db_session):
    """Valencia/Alicante (ES-VC) gets its regional holidays but not Madrid's."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = SAMPLE_API_RESPONSE_WITH_REGIONS
    mock_response.raise_for_status = MagicMock()

    # Alicante (ES-VC) should get: Ano Nuevo (global) + San Jose (ES-VC)
    # Should NOT get: Sant Jordi (ES-CT) or Dia de la Comunidad de Madrid (ES-MD)
    with patch("app.services.holidays.httpx.get", return_value=mock_response):
        holidays = fetch_holidays(2026, "Alicante", db_session)

    names = [h.name for h in holidays]
    assert "Ano Nuevo" in names
    assert "San Jose" in names
    assert "Sant Jordi" not in names
    assert "Dia de la Comunidad de Madrid" not in names
    assert len(holidays) == 2


# ---------------------------------------------------------------------------
# AC-3.4.3: Holiday API unavailable raises error
# ---------------------------------------------------------------------------


def test_holiday_api_unavailable_raises_error(db_session):
    """When API returns an error, the service should raise an exception."""
    mock_response = MagicMock()
    mock_response.status_code = 500
    mock_response.raise_for_status.side_effect = Exception("Server Error")

    with patch("app.services.holidays.httpx.get", return_value=mock_response):
        with pytest.raises(Exception, match="Server Error"):
            fetch_holidays(2026, "Madrid", db_session)


# ---------------------------------------------------------------------------
# AC-3.4.4: Saturday holiday classified as holiday
# ---------------------------------------------------------------------------


def test_saturday_holiday_classified_as_holiday():
    """A holiday that falls on Saturday should be classified as 'holiday'."""
    # 2026-01-03 is a Saturday
    saturday_date = datetime.date(2026, 1, 3)
    assert saturday_date.weekday() == 5  # confirm Saturday
    holidays = {saturday_date}

    day_type, duration, start, end = classify_day(saturday_date, holidays)
    assert day_type == "holiday"
    assert duration == 23
    assert start == "09:00"
    assert end == "08:00+1"


# ---------------------------------------------------------------------------
# Sunday classified as holiday
# ---------------------------------------------------------------------------


def test_sunday_classified_as_holiday():
    """Sundays always get 'holiday' day_type."""
    # 2026-01-04 is a Sunday
    sunday_date = datetime.date(2026, 1, 4)
    assert sunday_date.weekday() == 6  # confirm Sunday
    holidays: set[datetime.date] = set()

    day_type, duration, start, end = classify_day(sunday_date, holidays)
    assert day_type == "holiday"
    assert duration == 23
    assert start == "09:00"
    assert end == "08:00+1"


# ---------------------------------------------------------------------------
# Weekday classified correctly
# ---------------------------------------------------------------------------


def test_weekday_classified_as_weekday():
    """Mon-Fri non-holidays get 'weekday' day_type."""
    # 2026-01-05 is a Monday
    monday_date = datetime.date(2026, 1, 5)
    assert monday_date.weekday() == 0  # confirm Monday
    holidays: set[datetime.date] = set()

    day_type, duration, start, end = classify_day(monday_date, holidays)
    assert day_type == "weekday"
    assert duration == 17
    assert start == "15:00"
    assert end == "08:00+1"


# ---------------------------------------------------------------------------
# Classify all days in a year
# ---------------------------------------------------------------------------


def test_classify_all_days_in_year():
    """Given a year and holidays, verify every day gets correct classification."""
    holidays = {
        datetime.date(2026, 1, 1),   # Thursday — holiday
        datetime.date(2026, 1, 6),   # Tuesday — holiday
        datetime.date(2026, 5, 1),   # Friday — holiday
        datetime.date(2026, 12, 25), # Friday — holiday
    }

    days = classify_year(2026, holidays)

    # 2026 is not a leap year
    assert len(days) == 365

    # Jan 1 — holiday
    jan1 = days[0]
    assert jan1.date == datetime.date(2026, 1, 1)
    assert jan1.day_type == "holiday"
    assert jan1.duration_hours == 23

    # Jan 2 — Friday (weekday)
    jan2 = days[1]
    assert jan2.date == datetime.date(2026, 1, 2)
    assert jan2.day_type == "weekday"
    assert jan2.duration_hours == 17

    # Jan 3 — Saturday (not a holiday)
    jan3 = days[2]
    assert jan3.date == datetime.date(2026, 1, 3)
    assert jan3.day_type == "saturday"
    assert jan3.duration_hours == 18
    assert jan3.shift_start == "15:00"
    assert jan3.shift_end == "09:00+1"

    # Jan 4 — Sunday
    jan4 = days[3]
    assert jan4.date == datetime.date(2026, 1, 4)
    assert jan4.day_type == "holiday"
    assert jan4.duration_hours == 23

    # All types present
    day_types = {d.day_type for d in days}
    assert day_types <= {"weekday", "saturday", "holiday"}

    # All non-holiday Saturdays classified correctly
    saturdays = [d for d in days if d.date.weekday() == 5 and d.date not in holidays]
    for s in saturdays:
        assert s.day_type == "saturday"

    # All Sundays classified as holiday
    sundays = [d for d in days if d.date.weekday() == 6]
    for s in sundays:
        assert s.day_type == "holiday"
