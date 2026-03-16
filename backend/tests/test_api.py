"""API integration tests — separate AC/AP pools.

Tests the new endpoints with rota_type in paths and request bodies.
"""

from unittest.mock import MagicMock, patch

import pytest

from app.config import settings


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


# AC pool of 4 doctors (should compute 1 doctor/day)
AC_POOL_4 = [
    {"id": "doc-001", "name": "Dr. Garcia", "department": "Medicina General"},
    {"id": "doc-002", "name": "Dr. Lopez", "department": "Pediatria"},
    {"id": "doc-003", "name": "Dr. Martinez", "department": "Cardiologia"},
    {"id": "doc-004", "name": "Dr. Sanchez", "department": "Neurologia"},
]

# AP pool of 5 doctors (should compute 1 doctor/day)
AP_POOL_5 = [
    {"id": "doc-011", "name": "Dr. Navarro", "department": "Urologia"},
    {"id": "doc-012", "name": "Dr. Torres", "department": "Neumologia"},
    {"id": "doc-013", "name": "Dr. Dominguez", "department": "Endocrinologia"},
    {"id": "doc-014", "name": "Dr. Vazquez", "department": "Reumatologia"},
    {"id": "doc-015", "name": "Dr. Ramos", "department": "Medicina General"},
]


# ---------------------------------------------------------------------------
# 1. POST /api/v1/rota/generate returns 201 for AC
# ---------------------------------------------------------------------------


def test_generate_ac_rota_returns_201(client):
    """POST /api/v1/rota/generate with AC pool returns 201."""
    with _mock_holiday_api():
        response = client.post(
            "/api/v1/rota/generate",
            json={"year": 2026, "rota_type": "AC", "pool": AC_POOL_4},
        )

    assert response.status_code == 201, response.text
    data = response.json()
    assert data["year"] == 2026
    assert data["rota_type"] == "AC"
    assert data["city"] == settings.CITY
    assert data["doctors_per_day"] == 1
    assert len(data["schedule"]) == 365
    assert "stats" in data
    assert len(data["stats"]["doctors"]) == 4


# ---------------------------------------------------------------------------
# 2. POST /api/v1/rota/generate returns 201 for AP
# ---------------------------------------------------------------------------


def test_generate_ap_rota_returns_201(client):
    """POST /api/v1/rota/generate with AP pool returns 201."""
    with _mock_holiday_api():
        response = client.post(
            "/api/v1/rota/generate",
            json={"year": 2026, "rota_type": "AP", "pool": AP_POOL_5},
        )

    assert response.status_code == 201, response.text
    data = response.json()
    assert data["year"] == 2026
    assert data["rota_type"] == "AP"
    assert data["doctors_per_day"] == 1
    assert len(data["schedule"]) == 365
    assert len(data["stats"]["doctors"]) == 5


# ---------------------------------------------------------------------------
# 3. Pool too small returns 400
# ---------------------------------------------------------------------------


def test_generate_rota_pool_too_small_returns_400(client):
    """Pool with 1 doctor returns 400."""
    with _mock_holiday_api():
        response = client.post(
            "/api/v1/rota/generate",
            json={
                "year": 2026,
                "rota_type": "AC",
                "pool": [{"id": "doc-001", "name": "Dr. Garcia", "department": "Med"}],
            },
        )

    assert response.status_code == 400


# ---------------------------------------------------------------------------
# 4. GET /{year}/{rota_type} returns stored rota
# ---------------------------------------------------------------------------


def test_get_rota_by_type_returns_stored(client):
    """After generating AC, GET /api/v1/rota/{year}/AC returns it."""
    with _mock_holiday_api():
        client.post(
            "/api/v1/rota/generate",
            json={"year": 2026, "rota_type": "AC", "pool": AC_POOL_4},
        )

    response = client.get("/api/v1/rota/2026/AC")
    assert response.status_code == 200
    data = response.json()
    assert data["year"] == 2026
    assert data["rota_type"] == "AC"
    assert len(data["schedule"]) == 365


# ---------------------------------------------------------------------------
# 5. GET /{year}/{rota_type} returns 404 when no rota
# ---------------------------------------------------------------------------


def test_get_rota_by_type_404_when_none(client):
    """GET /api/v1/rota/{year}/AC when no rota returns 404."""
    response = client.get("/api/v1/rota/2099/AC")
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# 6. GET /{year} returns both AC and AP
# ---------------------------------------------------------------------------


def test_get_rotas_returns_both(client):
    """GET /api/v1/rota/{year} returns list of both AC and AP rotas."""
    with _mock_holiday_api():
        client.post(
            "/api/v1/rota/generate",
            json={"year": 2026, "rota_type": "AC", "pool": AC_POOL_4},
        )
        client.post(
            "/api/v1/rota/generate",
            json={"year": 2026, "rota_type": "AP", "pool": AP_POOL_5},
        )

    response = client.get("/api/v1/rota/2026")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    types = {r["rota_type"] for r in data}
    assert types == {"AC", "AP"}


# ---------------------------------------------------------------------------
# 7. GET /{year} returns 404 when none
# ---------------------------------------------------------------------------


def test_get_rotas_404_when_none(client):
    """GET /api/v1/rota/{year} when no rotas returns 404."""
    response = client.get("/api/v1/rota/2099")
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# 8. GET with doctor_id filter
# ---------------------------------------------------------------------------


def test_get_rota_filter_by_doctor(client):
    """GET /api/v1/rota/{year}/AC?doctor_id=X returns only that doctor's days."""
    with _mock_holiday_api():
        client.post(
            "/api/v1/rota/generate",
            json={"year": 2026, "rota_type": "AC", "pool": AC_POOL_4},
        )

    response = client.get("/api/v1/rota/2026/AC?doctor_id=doc-001")
    assert response.status_code == 200
    data = response.json()
    # Every returned day should include doc-001
    for day in data["schedule"]:
        doctor_ids = [d["doctor_id"] for d in day["doctors"]]
        assert "doc-001" in doctor_ids, (
            f"Day {day['date']} does not involve doc-001"
        )
    # Should be fewer than 365 (not every day)
    assert len(data["schedule"]) < 365


def test_generate_ac_reduced_hours_includes_targets_and_refuerzos(client):
    """AC reduced-hours responses expose target metadata and linked refuerzos."""
    reduced_pool = [
        {**AC_POOL_4[0], "hours_reduced_per_day": 2},
        *AC_POOL_4[1:],
    ]

    with _mock_holiday_api():
        response = client.post(
            "/api/v1/rota/generate",
            json={"year": 2026, "rota_type": "AC", "pool": reduced_pool},
        )

    assert response.status_code == 201, response.text
    data = response.json()

    reduced_stats = next(
        doctor for doctor in data["stats"]["doctors"] if doctor["doctor_id"] == "doc-001"
    )
    assert reduced_stats["target_hours"] < 1620
    assert any(day["refuerzos"] for day in data["schedule"])


def test_replace_refuerzo_assignment(client):
    """PATCH can replace a refuerzo assignment when assignment_kind is provided."""
    reduced_pool = [
        {**AC_POOL_4[0], "hours_reduced_per_day": 2},
        *AC_POOL_4[1:],
    ]

    with _mock_holiday_api():
        generate_response = client.post(
            "/api/v1/rota/generate",
            json={"year": 2026, "rota_type": "AC", "pool": reduced_pool},
        )

    data = generate_response.json()
    day_with_refuerzo = next(day for day in data["schedule"] if day["refuerzos"])
    original_refuerzo = day_with_refuerzo["refuerzos"][0]

    # Use a doctor in the AC pool that is not the original refuerzo assignee or a primary on that day.
    replacement_doctor = next(
        doctor["id"]
        for doctor in reduced_pool
        if doctor["id"] != original_refuerzo["doctor_id"]
        and doctor["id"] not in {d["doctor_id"] for d in day_with_refuerzo["doctors"]}
    )

    response = client.patch(
        "/api/v1/rota/2026/AC/replace",
        json={
            "date": day_with_refuerzo["date"],
            "old_doctor_id": original_refuerzo["doctor_id"],
            "new_doctor_id": replacement_doctor,
            "assignment_kind": "refuerzo",
        },
    )

    assert response.status_code == 200, response.text
    replaced_day = next(
        day for day in response.json()["schedule"] if day["date"] == day_with_refuerzo["date"]
    )
    assert replaced_day["refuerzos"][0]["doctor_id"] == replacement_doctor


# ---------------------------------------------------------------------------
# 9. Re-generate replaces previous
# ---------------------------------------------------------------------------


def test_regenerate_replaces_previous(client):
    """Generating twice for same year+type replaces the old rota."""
    with _mock_holiday_api():
        resp1 = client.post(
            "/api/v1/rota/generate",
            json={"year": 2026, "rota_type": "AC", "pool": AC_POOL_4},
        )
        assert resp1.status_code == 201
        gen_at_1 = resp1.json()["generated_at"]

        resp2 = client.post(
            "/api/v1/rota/generate",
            json={"year": 2026, "rota_type": "AC", "pool": AC_POOL_4},
        )
        assert resp2.status_code == 201
        gen_at_2 = resp2.json()["generated_at"]

    assert gen_at_2 >= gen_at_1

    response = client.get("/api/v1/rota/2026/AC")
    assert response.status_code == 200


# ---------------------------------------------------------------------------
# 10. PATCH replace doctor assignment
# ---------------------------------------------------------------------------


def test_replace_doctor_assignment(client):
    """PATCH /api/v1/rota/{year}/AC/replace swaps a doctor."""
    with _mock_holiday_api():
        gen_resp = client.post(
            "/api/v1/rota/generate",
            json={"year": 2026, "rota_type": "AC", "pool": AC_POOL_4},
        )
    assert gen_resp.status_code == 201

    schedule = gen_resp.json()["schedule"]

    # Find a day where doc-001 is assigned
    target_day = None
    for day in schedule:
        doctor_ids = [d["doctor_id"] for d in day["doctors"]]
        if "doc-001" in doctor_ids and "doc-002" not in doctor_ids:
            target_day = day
            break

    assert target_day is not None, "Could not find a suitable day for replacement test"

    response = client.patch(
        "/api/v1/rota/2026/AC/replace",
        json={
            "date": target_day["date"],
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
    doctor_ids = [d["doctor_id"] for d in replaced_day["doctors"]]
    assert "doc-002" in doctor_ids
    assert "doc-001" not in doctor_ids


# ---------------------------------------------------------------------------
# 11. Replace updates stats
# ---------------------------------------------------------------------------


def test_replace_updates_stats(client):
    """After replacement, stats reflect the change."""
    with _mock_holiday_api():
        gen_resp = client.post(
            "/api/v1/rota/generate",
            json={"year": 2026, "rota_type": "AC", "pool": AC_POOL_4},
        )
    assert gen_resp.status_code == 201

    original_stats = gen_resp.json()["stats"]
    schedule = gen_resp.json()["schedule"]

    # Find a day where doc-001 is assigned but doc-003 is not
    target_day = None
    for day in schedule:
        doctor_ids = [d["doctor_id"] for d in day["doctors"]]
        if "doc-001" in doctor_ids and "doc-003" not in doctor_ids:
            target_day = day
            break

    assert target_day is not None

    response = client.patch(
        "/api/v1/rota/2026/AC/replace",
        json={
            "date": target_day["date"],
            "old_doctor_id": "doc-001",
            "new_doctor_id": "doc-003",
        },
    )
    assert response.status_code == 200
    new_stats = response.json()["stats"]

    # doc-001 should have fewer total hours
    orig_001 = next(d for d in original_stats["doctors"] if d["doctor_id"] == "doc-001")
    new_001 = next(d for d in new_stats["doctors"] if d["doctor_id"] == "doc-001")
    assert new_001["total_hours"] < orig_001["total_hours"]

    # doc-003 should have more total hours
    orig_003 = next(d for d in original_stats["doctors"] if d["doctor_id"] == "doc-003")
    new_003 = next(d for d in new_stats["doctors"] if d["doctor_id"] == "doc-003")
    assert new_003["total_hours"] > orig_003["total_hours"]


# ---------------------------------------------------------------------------
# 12. Replace invalid returns 404
# ---------------------------------------------------------------------------


def test_replace_invalid_returns_404(client):
    """Replace with non-existent doctor returns 404."""
    with _mock_holiday_api():
        client.post(
            "/api/v1/rota/generate",
            json={"year": 2026, "rota_type": "AC", "pool": AC_POOL_4},
        )

    response = client.patch(
        "/api/v1/rota/2026/AC/replace",
        json={
            "date": "2026-06-15",
            "old_doctor_id": "doc-nonexistent",
            "new_doctor_id": "doc-001",
        },
    )
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# 13. GET /api/v1/holidays/{year} returns holidays
# ---------------------------------------------------------------------------


def test_get_holidays_returns_list(client):
    """GET /api/v1/holidays/{year} returns holidays."""
    with _mock_holiday_api():
        response = client.get("/api/v1/holidays/2026")

    assert response.status_code == 200
    data = response.json()
    assert data["year"] == 2026
    assert data["city"] == settings.CITY
    assert len(data["holidays"]) > 0
    assert data["holidays"][0]["date"] == "2026-01-01"


# ---------------------------------------------------------------------------
# 14. GET /api/v1/config returns city
# ---------------------------------------------------------------------------


def test_get_config_returns_city(client):
    """GET /api/v1/config returns configured city."""
    response = client.get("/api/v1/config")
    assert response.status_code == 200
    data = response.json()
    assert data["city"] == settings.CITY


# ---------------------------------------------------------------------------
# 15. AC and AP rotas are independent (different pools)
# ---------------------------------------------------------------------------


def test_ac_ap_rotas_independent(client):
    """Generating AC and AP rotas uses separate pools."""
    with _mock_holiday_api():
        ac_resp = client.post(
            "/api/v1/rota/generate",
            json={"year": 2026, "rota_type": "AC", "pool": AC_POOL_4},
        )
        ap_resp = client.post(
            "/api/v1/rota/generate",
            json={"year": 2026, "rota_type": "AP", "pool": AP_POOL_5},
        )

    assert ac_resp.status_code == 201
    assert ap_resp.status_code == 201

    ac_data = ac_resp.json()
    ap_data = ap_resp.json()

    ac_doctor_ids = {d["doctor_id"] for d in ac_data["stats"]["doctors"]}
    ap_doctor_ids = {d["doctor_id"] for d in ap_data["stats"]["doctors"]}

    # Pools should be disjoint
    assert ac_doctor_ids & ap_doctor_ids == set()


# ---------------------------------------------------------------------------
# 16. Stats include monthly_hours
# ---------------------------------------------------------------------------


def test_stats_include_monthly_hours(client):
    """Stats response includes monthly_hours for each doctor."""
    with _mock_holiday_api():
        response = client.post(
            "/api/v1/rota/generate",
            json={"year": 2026, "rota_type": "AC", "pool": AC_POOL_4},
        )

    assert response.status_code == 201
    data = response.json()
    for doc_stat in data["stats"]["doctors"]:
        assert "monthly_hours" in doc_stat
        assert len(doc_stat["monthly_hours"]) > 0
