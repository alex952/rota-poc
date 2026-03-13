"""Tests for the assignment algorithm — separate AC/AP pools.

Covers the new requirements: separate pools, computed doctors_per_day,
hard minimum hours constraints, per-type rest days.
"""

import math
from collections import Counter
from datetime import date, timedelta

import pytest

from app.schemas.rota import DayInfo, DoctorIn
from app.services.assignment import (
    AC_MIN_HOURS_YEAR,
    AP_MIN_HOURS_YEAR,
    InfeasiblePoolError,
    _compute_doctors_per_day,
    generate_rota,
)
from app.services.holidays import classify_year
from app.services.stats import calculate_stats


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _make_pool(n: int) -> list[DoctorIn]:
    """Create a pool of n doctors."""
    return [
        DoctorIn(id=f"doc-{i:03d}", name=f"Dr. Doctor{i}", department=f"Dept{i}")
        for i in range(1, n + 1)
    ]


def _holidays_2026() -> set[date]:
    """A small representative set of Spanish holidays for 2026."""
    return {
        date(2026, 1, 1),   # Thu — Ano Nuevo
        date(2026, 1, 6),   # Tue — Reyes
        date(2026, 4, 2),   # Thu — Jueves Santo
        date(2026, 4, 3),   # Fri — Viernes Santo
        date(2026, 5, 1),   # Fri — Dia del Trabajador
        date(2026, 8, 15),  # Sat — Asuncion (Saturday holiday!)
        date(2026, 10, 12), # Mon — Fiesta Nacional
        date(2026, 11, 2),  # Mon — Todos los Santos (observed)
        date(2026, 12, 7),  # Mon — Constitucion (observed)
        date(2026, 12, 8),  # Tue — Inmaculada
        date(2026, 12, 25), # Fri — Navidad
    }


@pytest.fixture
def day_classifications_2026():
    return classify_year(2026, _holidays_2026())


@pytest.fixture
def total_yearly_hours(day_classifications_2026):
    return sum(d.duration_hours for d in day_classifications_2026)


# ---------------------------------------------------------------------------
# AC rota fixtures — pool of 4 (should give 1 doctor/day)
# ---------------------------------------------------------------------------


@pytest.fixture
def ac_pool_4():
    return _make_pool(4)


@pytest.fixture
def ac_rota_4(ac_pool_4, day_classifications_2026):
    return generate_rota(2026, "AC", ac_pool_4, day_classifications_2026)


# ---------------------------------------------------------------------------
# AP rota fixtures — pool of 5 (should give 1 doctor/day)
# ---------------------------------------------------------------------------


@pytest.fixture
def ap_pool_5():
    return _make_pool(5)


@pytest.fixture
def ap_rota_5(ap_pool_5, day_classifications_2026):
    return generate_rota(2026, "AP", ap_pool_5, day_classifications_2026)


# ---------------------------------------------------------------------------
# AC rota with larger pool — pool of 8 (should give 2 doctors/day)
# ---------------------------------------------------------------------------


@pytest.fixture
def ac_pool_8():
    return _make_pool(8)


@pytest.fixture
def ac_rota_8(ac_pool_8, day_classifications_2026):
    return generate_rota(2026, "AC", ac_pool_8, day_classifications_2026)


# ===========================================================================
# doctors_per_day computation tests
# ===========================================================================


def test_doctors_per_day_ac_pool_4(total_yearly_hours):
    """AC pool of 4 → 1 doctor/day."""
    dpd = _compute_doctors_per_day("AC", 4, total_yearly_hours)
    assert dpd == 1


def test_doctors_per_day_ac_pool_5(total_yearly_hours):
    """AC pool of 5 → 2 doctors/day (need more slots to meet 1620h/year)."""
    dpd = _compute_doctors_per_day("AC", 5, total_yearly_hours)
    assert dpd == 2


def test_doctors_per_day_ac_pool_8(total_yearly_hours):
    """AC pool of 8 → 2 doctors/day."""
    dpd = _compute_doctors_per_day("AC", 8, total_yearly_hours)
    assert dpd == 2


def test_doctors_per_day_ap_pool_10(total_yearly_hours):
    """AP pool of 10 → 1 doctor/day."""
    dpd = _compute_doctors_per_day("AP", 10, total_yearly_hours)
    assert dpd == 1


# ===========================================================================
# AC rota tests (pool of 4, 1 doctor/day)
# ===========================================================================


def test_ac_generates_full_year_schedule(ac_rota_4):
    """365 days returned with doctors assigned on every day."""
    assert len(ac_rota_4.schedule) == 365
    for day in ac_rota_4.schedule:
        assert len(day.doctors) >= 1


def test_ac_rota_type_is_ac(ac_rota_4):
    """Rota type should be AC."""
    assert ac_rota_4.rota_type == "AC"


def test_ac_doctors_per_day_stored(ac_rota_4):
    """doctors_per_day should be stored in the result."""
    assert ac_rota_4.doctors_per_day == 1


def test_ac_minimum_hours_met_hard(ac_rota_4):
    """Every doctor has >= 1620h (hard constraint, no warnings)."""
    for doc_stat in ac_rota_4.stats.doctors:
        assert doc_stat.total_hours >= AC_MIN_HOURS_YEAR, (
            f"{doc_stat.doctor_name} has only {doc_stat.total_hours}h, "
            f"below the {AC_MIN_HOURS_YEAR}h minimum"
        )


def test_ac_equity_total_hours(ac_rota_4):
    """Max-min difference in total hours is minimized."""
    hours = [s.total_hours for s in ac_rota_4.stats.doctors]
    diff = max(hours) - min(hours)
    assert diff <= 100, f"Hour equity gap too large: {diff}h"


def test_ac_rest_day_after_oncall(ac_rota_4):
    """A doctor assigned on day D has no assignment on D+1."""
    schedule = ac_rota_4.schedule
    date_map = {day.date: day for day in schedule}

    for day in schedule:
        next_date = day.date + timedelta(days=1)
        if next_date not in date_map:
            continue
        next_day = date_map[next_date]

        today_doctors = {d.doctor_id for d in day.doctors}
        tomorrow_doctors = {d.doctor_id for d in next_day.doctors}

        overlap = today_doctors & tomorrow_doctors
        assert not overlap, (
            f"Doctor(s) {overlap} assigned on {day.date} AND {next_date} (rest-day violation)"
        )


def test_ac_sparsity_minimized(ac_rota_4):
    """Assignments are spread out — minimum gap >= 2 due to rest-day rule."""
    doctor_dates: dict[str, list[date]] = {}
    for day in ac_rota_4.schedule:
        for doc in day.doctors:
            doctor_dates.setdefault(doc.doctor_id, []).append(day.date)

    for did, dates in doctor_dates.items():
        dates.sort()
        if len(dates) < 2:
            continue
        gaps = [(dates[i + 1] - dates[i]).days for i in range(len(dates) - 1)]
        min_gap = min(gaps)
        assert min_gap >= 2, (
            f"Doctor {did} has gap of {min_gap} days (should be >= 2)"
        )


# ===========================================================================
# AP rota tests (pool of 5, 1 doctor/day)
# ===========================================================================


def test_ap_generates_full_year_schedule(ap_rota_5):
    """365 days returned."""
    assert len(ap_rota_5.schedule) == 365


def test_ap_rota_type_is_ap(ap_rota_5):
    """Rota type should be AP."""
    assert ap_rota_5.rota_type == "AP"


def test_ap_minimum_hours_met_hard(ap_rota_5):
    """Every doctor has >= 425h (hard constraint)."""
    for doc_stat in ap_rota_5.stats.doctors:
        assert doc_stat.total_hours >= AP_MIN_HOURS_YEAR, (
            f"{doc_stat.doctor_name} has only {doc_stat.total_hours}h, "
            f"below the {AP_MIN_HOURS_YEAR}h minimum"
        )


def test_ap_equity_total_hours(ap_rota_5):
    """Max-min difference in total hours is minimized."""
    hours = [s.total_hours for s in ap_rota_5.stats.doctors]
    diff = max(hours) - min(hours)
    assert diff <= 100, f"Hour equity gap too large: {diff}h"


# ===========================================================================
# AC rota with multi-doctor days (pool of 8, 2 doctors/day)
# ===========================================================================


def test_ac_multi_doctor_per_day(ac_rota_8):
    """Each day should have 2 doctors assigned."""
    for day in ac_rota_8.schedule:
        assert len(day.doctors) == 2, (
            f"Day {day.date} has {len(day.doctors)} doctors, expected 2"
        )


def test_ac_multi_doctor_no_duplicate_per_day(ac_rota_8):
    """No doctor should appear twice on the same day."""
    for day in ac_rota_8.schedule:
        ids = [d.doctor_id for d in day.doctors]
        assert len(ids) == len(set(ids)), (
            f"Duplicate doctor on {day.date}: {ids}"
        )


def test_ac_multi_doctor_minimum_hours(ac_rota_8):
    """Every doctor meets 1620h minimum even with 2 docs/day."""
    for doc_stat in ac_rota_8.stats.doctors:
        assert doc_stat.total_hours >= AC_MIN_HOURS_YEAR, (
            f"{doc_stat.doctor_name} has only {doc_stat.total_hours}h"
        )


def test_ac_multi_doctor_doctors_per_day_stored(ac_rota_8):
    """doctors_per_day should be 2."""
    assert ac_rota_8.doctors_per_day == 2


# ===========================================================================
# Shift durations by day type
# ===========================================================================


def test_shift_durations(ac_rota_4):
    """Holidays/Sundays use 23h, Saturdays 18h, weekdays 17h."""
    for day in ac_rota_4.schedule:
        if day.day_type == "holiday":
            assert day.duration_hours == 23
            assert day.shift_start == "09:00"
            assert day.shift_end == "08:00+1"
        elif day.day_type == "saturday":
            assert day.duration_hours == 18
            assert day.shift_start == "15:00"
            assert day.shift_end == "09:00+1"
        elif day.day_type == "weekday":
            assert day.duration_hours == 17
            assert day.shift_start == "15:00"
            assert day.shift_end == "08:00+1"


def test_saturday_holiday_uses_holiday_hours(ac_rota_4):
    """A holiday on Saturday uses 23h (holiday), not 18h (saturday)."""
    aug15 = date(2026, 8, 15)
    day_entry = next((d for d in ac_rota_4.schedule if d.date == aug15), None)
    assert day_entry is not None
    assert day_entry.day_type == "holiday"
    assert day_entry.duration_hours == 23


# ===========================================================================
# Feasibility checks — hard constraints
# ===========================================================================


def test_feasibility_pool_too_small_ac():
    """AC pool of 1 should raise error (need at least 2 for rest rotation)."""
    pool = _make_pool(1)
    days = classify_year(2026, _holidays_2026())

    with pytest.raises(InfeasiblePoolError, match="too small"):
        generate_rota(2026, "AC", pool, days)


def test_feasibility_pool_too_small_ap():
    """AP pool of 1 should raise error."""
    pool = _make_pool(1)
    days = classify_year(2026, _holidays_2026())

    with pytest.raises(InfeasiblePoolError, match="too small"):
        generate_rota(2026, "AP", pool, days)


def test_hard_constraint_no_warnings_on_valid_pool(ac_rota_4):
    """Valid AC rota should have no warnings — minimums are hard now."""
    assert len(ac_rota_4.warnings) == 0


# ===========================================================================
# Stats have monthly_hours
# ===========================================================================


def test_stats_have_monthly_hours(ac_rota_4):
    """Stats should include monthly hour breakdown."""
    for doc_stat in ac_rota_4.stats.doctors:
        assert len(doc_stat.monthly_hours) > 0
        total_from_monthly = sum(doc_stat.monthly_hours.values())
        assert total_from_monthly == doc_stat.total_hours


# ===========================================================================
# Equity by day type
# ===========================================================================


def test_equity_by_day_type(ac_rota_4):
    """Each doctor has roughly same count of weekday/saturday/holiday shifts."""
    doctor_counts: dict[str, dict[str, int]] = {}
    for day in ac_rota_4.schedule:
        for doc in day.doctors:
            if doc.doctor_id not in doctor_counts:
                doctor_counts[doc.doctor_id] = {"weekday": 0, "saturday": 0, "holiday": 0}
            doctor_counts[doc.doctor_id][day.day_type] += 1

    for day_type in ["weekday", "saturday", "holiday"]:
        values = [counts[day_type] for counts in doctor_counts.values()]
        diff = max(values) - min(values)
        assert diff <= 2, (
            f"{day_type} equity violated: max-min={diff}, values={values}"
        )
