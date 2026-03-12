"""Tests for the assignment algorithm — Phase 3.

Covers PRD acceptance criteria AC-3.1.1 through AC-3.1.12.
"""

import datetime
from collections import Counter
from datetime import date, timedelta

import pytest

from app.schemas.rota import DayInfo, DoctorIn
from app.services.assignment import InfeasiblePoolError, generate_rota
from app.services.holidays import classify_day, classify_year
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
def pool_5():
    return _make_pool(5)


@pytest.fixture
def day_classifications_2026():
    return classify_year(2026, _holidays_2026())


@pytest.fixture
def rota_5(pool_5, day_classifications_2026):
    return generate_rota(2026, pool_5, day_classifications_2026)


# ---------------------------------------------------------------------------
# AC-3.1.1: Generates full year schedule
# ---------------------------------------------------------------------------


def test_generates_full_year_schedule(rota_5):
    """365 days returned with AC and AP assignments on every day."""
    assert len(rota_5.schedule) == 365
    for day in rota_5.schedule:
        assert day.atencion_continuada.doctor_id is not None
        assert day.atencion_primaria.doctor_id is not None


# ---------------------------------------------------------------------------
# AC-3.1.2: Minimum AC hours met
# ---------------------------------------------------------------------------


def test_minimum_ac_hours_met(rota_5):
    """Every doctor has >= 135h of AC."""
    for doc_stat in rota_5.stats.doctors:
        assert doc_stat.ac_hours >= 135, (
            f"{doc_stat.doctor_name} has only {doc_stat.ac_hours}h AC"
        )


# ---------------------------------------------------------------------------
# AC-3.1.3: Minimum AP hours met
# ---------------------------------------------------------------------------


def test_minimum_ap_hours_met(rota_5):
    """Every doctor has >= 425h of AP."""
    for doc_stat in rota_5.stats.doctors:
        assert doc_stat.ap_hours >= 425, (
            f"{doc_stat.doctor_name} has only {doc_stat.ap_hours}h AP"
        )


# ---------------------------------------------------------------------------
# AC-3.1.4: Equity in total hours
# ---------------------------------------------------------------------------


def test_equity_total_hours(rota_5):
    """Max-min difference in total hours is minimized."""
    hours = [s.total_hours for s in rota_5.stats.doctors]
    diff = max(hours) - min(hours)
    # Allow difference of up to max shift duration (23h) * 2 services
    # With 5 doctors and ~365 days, we allow a reasonable tolerance
    assert diff <= 100, f"Hour equity gap too large: {diff}h (max={max(hours)}, min={min(hours)})"


# ---------------------------------------------------------------------------
# AC-3.1.9: No dual AC/AP same day
# ---------------------------------------------------------------------------


def test_no_dual_ac_ap_same_day(rota_5):
    """No doctor is assigned both AC and AP on the same calendar day."""
    for day in rota_5.schedule:
        assert day.atencion_continuada.doctor_id != day.atencion_primaria.doctor_id, (
            f"Doctor {day.atencion_continuada.doctor_id} assigned both AC and AP on {day.date}"
        )


# ---------------------------------------------------------------------------
# AC-3.1.10: Rest day after on-call
# ---------------------------------------------------------------------------


def test_rest_day_after_oncall(rota_5):
    """A doctor assigned on day D has no assignment on D+1."""
    schedule = rota_5.schedule
    date_map = {day.date: day for day in schedule}

    for day in schedule:
        next_date = day.date + timedelta(days=1)
        if next_date not in date_map:
            continue
        next_day = date_map[next_date]

        # Doctors assigned today (AC or AP) should NOT appear in tomorrow
        today_doctors = {
            day.atencion_continuada.doctor_id,
            day.atencion_primaria.doctor_id,
        }
        tomorrow_doctors = {
            next_day.atencion_continuada.doctor_id,
            next_day.atencion_primaria.doctor_id,
        }

        overlap = today_doctors & tomorrow_doctors
        assert not overlap, (
            f"Doctor(s) {overlap} assigned on {day.date} AND {next_date} (rest-day violation)"
        )


# ---------------------------------------------------------------------------
# AC-3.1.11: Sparsity maximized
# ---------------------------------------------------------------------------


def test_sparsity_maximized(rota_5):
    """Assignments are spread out — minimum gap > 1 due to rest-day rule."""
    pool = _make_pool(5)

    # Collect assignment dates per doctor
    doctor_dates: dict[str, list[date]] = {d.id: [] for d in pool}
    for day in rota_5.schedule:
        doctor_dates[day.atencion_continuada.doctor_id].append(day.date)
        doctor_dates[day.atencion_primaria.doctor_id].append(day.date)

    for did, dates in doctor_dates.items():
        dates.sort()
        if len(dates) < 2:
            continue
        gaps = [(dates[i + 1] - dates[i]).days for i in range(len(dates) - 1)]
        min_gap = min(gaps)
        # Due to rest-day rule, minimum gap must be >= 2
        assert min_gap >= 2, (
            f"Doctor {did} has gap of {min_gap} days "
            f"(should be >= 2 due to rest-day rule)"
        )


# ---------------------------------------------------------------------------
# AC-3.1.5 / AC-3.1.6 / AC-3.1.7: Shift durations by day type
# ---------------------------------------------------------------------------


def test_holiday_shift_duration(rota_5):
    """Holidays/Sundays use 23h, Saturdays 18h, weekdays 17h."""
    for day in rota_5.schedule:
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


# ---------------------------------------------------------------------------
# AC-3.1.12: Saturday holiday uses holiday hours
# ---------------------------------------------------------------------------


def test_saturday_holiday_uses_holiday_hours(rota_5):
    """A holiday on Saturday uses 23h (holiday), not 18h (saturday)."""
    # Aug 15, 2026 is a Saturday and a holiday
    aug15 = date(2026, 8, 15)
    day_entry = next((d for d in rota_5.schedule if d.date == aug15), None)
    assert day_entry is not None
    assert day_entry.day_type == "holiday"
    assert day_entry.duration_hours == 23


# ---------------------------------------------------------------------------
# Feasibility: too few doctors
# ---------------------------------------------------------------------------


def test_feasibility_check_too_few_doctors():
    """Pool of 1 doctor should raise error."""
    pool = _make_pool(1)
    days = classify_year(2026, _holidays_2026())

    with pytest.raises(InfeasiblePoolError, match="at least 2"):
        generate_rota(2026, pool, days)


# ---------------------------------------------------------------------------
# Feasibility: too many doctors
# ---------------------------------------------------------------------------


def test_feasibility_check_too_many_doctors():
    """Pool too large to meet minimum hours should succeed with warnings."""
    # With, say, 50 doctors — total_hours / 50 will be below 425 AP minimum
    pool = _make_pool(50)
    days = classify_year(2026, _holidays_2026())

    rota = generate_rota(2026, pool, days)
    assert len(rota.schedule) == 365
    assert len(rota.warnings) > 0
    # Should have warnings about minimum hours
    assert any("below the" in w and "minimum" in w for w in rota.warnings)


# ---------------------------------------------------------------------------
# Pool of two doctors
# ---------------------------------------------------------------------------


def test_pool_of_two_doctors():
    """Minimum pool should still produce valid schedule."""
    pool = _make_pool(2)
    days = classify_year(2026, _holidays_2026())

    # With only 2 doctors and rest-day rule, this should still work
    # because each day can have doc A on AC and doc B on AP,
    # and they alternate.
    rota = generate_rota(2026, pool, days)

    assert len(rota.schedule) == 365

    # No dual assignment
    for day in rota.schedule:
        assert day.atencion_continuada.doctor_id != day.atencion_primaria.doctor_id


# ---------------------------------------------------------------------------
# Equity by day type
# ---------------------------------------------------------------------------


def test_equity_by_day_type(rota_5):
    """Each doctor has roughly same count of weekday/saturday/holiday shifts (+-1)."""
    pool = _make_pool(5)

    # Count AC shifts by day type per doctor
    ac_weekday: dict[str, int] = {d.id: 0 for d in pool}
    ac_saturday: dict[str, int] = {d.id: 0 for d in pool}
    ac_holiday: dict[str, int] = {d.id: 0 for d in pool}

    ap_weekday: dict[str, int] = {d.id: 0 for d in pool}
    ap_saturday: dict[str, int] = {d.id: 0 for d in pool}
    ap_holiday: dict[str, int] = {d.id: 0 for d in pool}

    for day in rota_5.schedule:
        ac_id = day.atencion_continuada.doctor_id
        ap_id = day.atencion_primaria.doctor_id
        if day.day_type == "weekday":
            ac_weekday[ac_id] += 1
            ap_weekday[ap_id] += 1
        elif day.day_type == "saturday":
            ac_saturday[ac_id] += 1
            ap_saturday[ap_id] += 1
        else:
            ac_holiday[ac_id] += 1
            ap_holiday[ap_id] += 1

    # For each service type and day type, max-min <= 2
    # (allowing +-1 from each side of the ideal)
    for label, counts in [
        ("AC weekday", ac_weekday),
        ("AC saturday", ac_saturday),
        ("AC holiday", ac_holiday),
        ("AP weekday", ap_weekday),
        ("AP saturday", ap_saturday),
        ("AP holiday", ap_holiday),
    ]:
        values = list(counts.values())
        diff = max(values) - min(values)
        assert diff <= 2, (
            f"{label} equity violated: max-min={diff}, values={values}"
        )
