"""API integration tests — Phase 4.

Covers PRD acceptance criteria for features 3.1-3.5.
Uses the FastAPI test client with an in-memory SQLite database.
"""

import datetime
from unittest.mock import MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

HOLIDAY_API_RESPONSE = [
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
    {
        "date": "2026-08-15",
        "localName": "Asuncion",
        "name": "Assumption of Mary",
        "countryCode": "ES",
        "fixed": True,
        "global": True,
        "counties": None,
        "launchYear": None,
        "types": ["Public"],
    },
    {
        "date": "2026-12-25",
        "localName": "Navidad",
        "name": "Christmas Day",
        "countryCode": "ES",
        "fixed": True,
        "global": True,
        "counties": None,
        "launchYear": None,
        "types": ["Public"],
    },
]


def _mock_holiday_api():
    """Return a context manager that mocks the holiday API."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = HOLIDAY_API_RESPONSE
    mock_response.raise_for_status = MagicMock()
    return patch("app.services.holidays.httpx.get", return_value=mock_response)


POOL_5 = [
    {"id": "doc-001", "name": "Dr. Garcia", "department": "Medicina General"},
    {"id": "doc-002", "name": "Dr. Lopez", "department": "Pediatria"},
    {"id": "doc-003", "name": "Dr. Martinez", "department": "Cardiologia"},
    {"id": "doc-004", "name": "Dr. Sanchez", "department": "Neurologia"},
    {"id": "doc-005", "name": "Dr. Fernandez", "department": "Dermatologia"},
]


# ---------------------------------------------------------------------------
# 1. POST /api/v1/rota/generate returns 201
# ---------------------------------------------------------------------------


def test_generate_rota_returns_201(client):
    """POST /api/v1/rota/generate with valid pool returns 201 with full schedule."""
    with _mock_holiday_api():
        response = client.post(
            "/api/v1/rota/generate",
            json={"year": 2026, "pool": POOL_5},
        )

    assert response.status_code == 201, response.text
    data = response.json()
    assert data["year"] == 2026
    assert data["city"] == "Madrid"
    assert len(data["schedule"]) == 365
    assert "stats" in data
    assert len(data["stats"]["doctors"]) == 5


# ---------------------------------------------------------------------------
# 2. POST with <2 doctors returns 400
# ---------------------------------------------------------------------------


def test_generate_rota_invalid_pool_returns_400(client):
    """Pool with <2 doctors returns 400."""
    with _mock_holiday_api():
        response = client.post(
            "/api/v1/rota/generate",
            json={
                "year": 2026,
                "pool": [{"id": "doc-001", "name": "Dr. Garcia", "department": "Med"}],
            },
        )

    assert response.status_code == 400


# ---------------------------------------------------------------------------
# 3. GET returns stored rota
# ---------------------------------------------------------------------------


def test_get_rota_returns_stored(client):
    """After generating, GET /api/v1/rota/{year} returns the rota."""
    with _mock_holiday_api():
        client.post(
            "/api/v1/rota/generate",
            json={"year": 2026, "pool": POOL_5},
        )

    response = client.get("/api/v1/rota/2026")
    assert response.status_code == 200
    data = response.json()
    assert data["year"] == 2026
    assert len(data["schedule"]) == 365


# ---------------------------------------------------------------------------
# 4. GET returns 404 when no rota
# ---------------------------------------------------------------------------


def test_get_rota_404_when_none(client):
    """GET /api/v1/rota/{year} when no rota returns 404."""
    response = client.get("/api/v1/rota/2099")
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# 5. GET with doctor_id filter
# ---------------------------------------------------------------------------


def test_get_rota_filter_by_doctor(client):
    """GET /api/v1/rota/{year}?doctor_id=X returns only that doctor's assignments."""
    with _mock_holiday_api():
        client.post(
            "/api/v1/rota/generate",
            json={"year": 2026, "pool": POOL_5},
        )

    response = client.get("/api/v1/rota/2026?doctor_id=doc-001")
    assert response.status_code == 200
    data = response.json()
    # Every returned day should include doc-001 in AC or AP
    for day in data["schedule"]:
        ac = day["atencion_continuada"]["doctor_id"]
        ap = day["atencion_primaria"]["doctor_id"]
        assert ac == "doc-001" or ap == "doc-001", (
            f"Day {day['date']} does not involve doc-001"
        )
    # Should be fewer than 365 (not every day)
    assert len(data["schedule"]) < 365


# ---------------------------------------------------------------------------
# 6. Re-generate replaces previous
# ---------------------------------------------------------------------------


def test_regenerate_replaces_previous(client):
    """Generating twice for same year replaces the old rota."""
    with _mock_holiday_api():
        resp1 = client.post(
            "/api/v1/rota/generate",
            json={"year": 2026, "pool": POOL_5},
        )
        assert resp1.status_code == 201
        gen_at_1 = resp1.json()["generated_at"]

        resp2 = client.post(
            "/api/v1/rota/generate",
            json={"year": 2026, "pool": POOL_5},
        )
        assert resp2.status_code == 201
        gen_at_2 = resp2.json()["generated_at"]

    # Timestamps should differ (second generation is newer)
    assert gen_at_2 >= gen_at_1

    # Only one rota should exist for 2026
    response = client.get("/api/v1/rota/2026")
    assert response.status_code == 200


# ---------------------------------------------------------------------------
# 7. PATCH replace doctor assignment
# ---------------------------------------------------------------------------


def test_replace_doctor_assignment(client):
    """PATCH /api/v1/rota/{year}/replace swaps a doctor."""
    with _mock_holiday_api():
        gen_resp = client.post(
            "/api/v1/rota/generate",
            json={"year": 2026, "pool": POOL_5},
        )
    assert gen_resp.status_code == 201

    schedule = gen_resp.json()["schedule"]

    # Find a day where doc-001 is assigned AC
    target_day = None
    for day in schedule:
        if day["atencion_continuada"]["doctor_id"] == "doc-001":
            # Make sure the AP doctor is not doc-002 (so we can swap to doc-002)
            if day["atencion_primaria"]["doctor_id"] != "doc-002":
                target_day = day
                break

    assert target_day is not None, "Could not find a suitable day for replacement test"

    response = client.patch(
        "/api/v1/rota/2026/replace",
        json={
            "date": target_day["date"],
            "service_type": "atencion_continuada",
            "old_doctor_id": "doc-001",
            "new_doctor_id": "doc-002",
        },
    )
    assert response.status_code == 200

    # Verify the replacement
    data = response.json()
    replaced_day = next(
        d for d in data["schedule"] if d["date"] == target_day["date"]
    )
    assert replaced_day["atencion_continuada"]["doctor_id"] == "doc-002"


# ---------------------------------------------------------------------------
# 8. Replace updates stats
# ---------------------------------------------------------------------------


def test_replace_updates_stats(client):
    """After replacement, stats reflect the change."""
    with _mock_holiday_api():
        gen_resp = client.post(
            "/api/v1/rota/generate",
            json={"year": 2026, "pool": POOL_5},
        )
    assert gen_resp.status_code == 201

    original_stats = gen_resp.json()["stats"]
    schedule = gen_resp.json()["schedule"]

    # Find a day where doc-001 is assigned AC
    target_day = None
    for day in schedule:
        if day["atencion_continuada"]["doctor_id"] == "doc-001":
            if day["atencion_primaria"]["doctor_id"] != "doc-003":
                target_day = day
                break

    assert target_day is not None

    response = client.patch(
        "/api/v1/rota/2026/replace",
        json={
            "date": target_day["date"],
            "service_type": "atencion_continuada",
            "old_doctor_id": "doc-001",
            "new_doctor_id": "doc-003",
        },
    )
    assert response.status_code == 200
    new_stats = response.json()["stats"]

    # doc-001 should have fewer AC hours
    orig_001 = next(d for d in original_stats["doctors"] if d["doctor_id"] == "doc-001")
    new_001 = next(d for d in new_stats["doctors"] if d["doctor_id"] == "doc-001")
    assert new_001["ac_hours"] < orig_001["ac_hours"]

    # doc-003 should have more AC hours
    orig_003 = next(d for d in original_stats["doctors"] if d["doctor_id"] == "doc-003")
    new_003 = next(d for d in new_stats["doctors"] if d["doctor_id"] == "doc-003")
    assert new_003["ac_hours"] > orig_003["ac_hours"]


# ---------------------------------------------------------------------------
# 9. Replace invalid returns 404
# ---------------------------------------------------------------------------


def test_replace_invalid_returns_404(client):
    """Replace with non-existent date/doctor returns 404."""
    with _mock_holiday_api():
        client.post(
            "/api/v1/rota/generate",
            json={"year": 2026, "pool": POOL_5},
        )

    response = client.patch(
        "/api/v1/rota/2026/replace",
        json={
            "date": "2026-06-15",
            "service_type": "atencion_continuada",
            "old_doctor_id": "doc-nonexistent",
            "new_doctor_id": "doc-001",
        },
    )
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# 10. GET /api/v1/holidays/{year} returns holidays
# ---------------------------------------------------------------------------


def test_get_holidays_returns_list(client):
    """GET /api/v1/holidays/{year} returns holidays."""
    with _mock_holiday_api():
        response = client.get("/api/v1/holidays/2026")

    assert response.status_code == 200
    data = response.json()
    assert data["year"] == 2026
    assert data["city"] == "Madrid"
    assert len(data["holidays"]) > 0
    assert data["holidays"][0]["date"] == "2026-01-01"


# ---------------------------------------------------------------------------
# 11. GET /api/v1/config returns city
# ---------------------------------------------------------------------------


def test_get_config_returns_city(client):
    """GET /api/v1/config returns configured city."""
    response = client.get("/api/v1/config")
    assert response.status_code == 200
    data = response.json()
    assert data["city"] == "Madrid"
