"""Assignment service — core scheduling algorithm.

Implements the Balanced Round-Robin with rest-day & sparsity constraints
from the technical design document.
"""

import math
from datetime import date, timedelta

from app.schemas.rota import (
    DayAssignment,
    DayInfo,
    DoctorIn,
    DoctorRef,
    DoctorStats,
    RotaSchedule,
    StatsResponse,
)
from app.services.stats import calculate_stats


class InfeasiblePoolError(Exception):
    """Raised when the doctor pool cannot satisfy constraints."""
    pass


def _gap_since_last(last_assigned: date | None, current: date) -> int:
    """Return the number of days since last assignment, or a large number if never assigned."""
    if last_assigned is None:
        return 9999  # never assigned — maximum sparsity
    return (current - last_assigned).days


def generate_rota(
    year: int,
    pool: list[DoctorIn],
    day_classifications: list[DayInfo],
) -> RotaSchedule:
    """Generate a full-year rota schedule.

    Algorithm (single-pass):
    1. Feasibility check
    2. For each day, assign AC then AP together, enforcing:
       - HC-1: No dual AC/AP same day for same doctor
       - HC-2: Rest-day after on-call (global across AC and AP) - soft constraint
         when pool is too small
       - Sparsity: maximize gap between consecutive assignments
       - Equity: balance day-type counts and hours across doctors
    3. Return schedule + stats
    """
    n_doctors = len(pool)
    n_days = len(day_classifications)

    # --- Feasibility check ---
    warnings = _check_feasibility(pool, day_classifications)

    doctor_ids = [d.id for d in pool]
    doctor_map = {d.id: d for d in pool}

    # Global tracking: last date any assignment (AC or AP) for each doctor
    last_assigned_global: dict[str, date | None] = {did: None for did in doctor_ids}

    # Per-service last-assigned for sparsity within each service type
    ac_last: dict[str, date | None] = {did: None for did in doctor_ids}
    ap_last: dict[str, date | None] = {did: None for did in doctor_ids}

    # Per-doctor, per-service hour counters
    ac_hours: dict[str, int] = {did: 0 for did in doctor_ids}
    ap_hours: dict[str, int] = {did: 0 for did in doctor_ids}

    # Per-doctor, per-service, per-day-type counters for equity
    ac_weekday_count: dict[str, int] = {did: 0 for did in doctor_ids}
    ac_saturday_count: dict[str, int] = {did: 0 for did in doctor_ids}
    ac_holiday_count: dict[str, int] = {did: 0 for did in doctor_ids}

    ap_weekday_count: dict[str, int] = {did: 0 for did in doctor_ids}
    ap_saturday_count: dict[str, int] = {did: 0 for did in doctor_ids}
    ap_holiday_count: dict[str, int] = {did: 0 for did in doctor_ids}

    def _day_type_count(counts_weekday, counts_sat, counts_hol, did, day_type):
        if day_type == "weekday":
            return counts_weekday[did]
        elif day_type == "saturday":
            return counts_sat[did]
        else:
            return counts_hol[did]

    # -----------------------------------------------------------------------
    # Single pass: Assign AC and AP for each day together
    # -----------------------------------------------------------------------
    schedule: list[DayAssignment] = []

    for day_info in day_classifications:
        d = day_info.date
        prev_day = d - timedelta(days=1)

        # Build eligible set for this day: prefer doctors NOT assigned on D-1
        # (rest-day rule HC-2 — global across both AC and AP)
        rested = []
        unrested = []
        for did in doctor_ids:
            if last_assigned_global[did] == prev_day:
                unrested.append(did)
            else:
                rested.append(did)

        # If we have at least 2 rested doctors, use only rested ones.
        # Otherwise, fall back to all doctors (rest-day becomes soft constraint).
        if len(rested) >= 2:
            available_today = rested
        else:
            available_today = rested + unrested

        if len(available_today) < 2:
            raise InfeasiblePoolError(
                f"Not enough eligible doctors on {d}. Pool is too small."
            )

        # --- Assign AC ---
        # Sort by: 1) fewest day-type AC shifts (equity), 2) fewest AC hours,
        #          3) largest gap since last global assignment (sparsity)
        available_today_sorted = sorted(
            available_today,
            key=lambda did: (
                _day_type_count(
                    ac_weekday_count, ac_saturday_count, ac_holiday_count,
                    did, day_info.day_type
                ),
                ac_hours[did],
                -_gap_since_last(last_assigned_global[did], d),
            )
        )

        ac_chosen = available_today_sorted[0]

        # --- Assign AP ---
        # From the remaining available doctors (excluding AC doctor for HC-1)
        ap_candidates = [did for did in available_today if did != ac_chosen]

        if not ap_candidates:
            raise InfeasiblePoolError(
                f"No eligible doctor for AP on {d}. Pool is too small."
            )

        # Sort by: 1) fewest day-type AP shifts (equity), 2) fewest AP hours,
        #          3) largest gap since last global assignment (sparsity)
        ap_candidates_sorted = sorted(
            ap_candidates,
            key=lambda did: (
                _day_type_count(
                    ap_weekday_count, ap_saturday_count, ap_holiday_count,
                    did, day_info.day_type
                ),
                ap_hours[did],
                -_gap_since_last(last_assigned_global[did], d),
            )
        )

        ap_chosen = ap_candidates_sorted[0]

        # --- Update tracking ---
        last_assigned_global[ac_chosen] = d
        last_assigned_global[ap_chosen] = d
        ac_last[ac_chosen] = d
        ap_last[ap_chosen] = d

        ac_hours[ac_chosen] += day_info.duration_hours
        ap_hours[ap_chosen] += day_info.duration_hours

        if day_info.day_type == "weekday":
            ac_weekday_count[ac_chosen] += 1
            ap_weekday_count[ap_chosen] += 1
        elif day_info.day_type == "saturday":
            ac_saturday_count[ac_chosen] += 1
            ap_saturday_count[ap_chosen] += 1
        else:
            ac_holiday_count[ac_chosen] += 1
            ap_holiday_count[ap_chosen] += 1

        # --- Build day assignment ---
        schedule.append(
            DayAssignment(
                date=d,
                day_type=day_info.day_type,
                shift_start=day_info.shift_start,
                shift_end=day_info.shift_end,
                duration_hours=day_info.duration_hours,
                atencion_continuada=DoctorRef(
                    doctor_id=ac_chosen,
                    doctor_name=doctor_map[ac_chosen].name,
                ),
                atencion_primaria=DoctorRef(
                    doctor_id=ap_chosen,
                    doctor_name=doctor_map[ap_chosen].name,
                ),
            )
        )

    # -----------------------------------------------------------------------
    # Calculate stats
    # -----------------------------------------------------------------------
    stats_list = calculate_stats(schedule, pool)
    stats = StatsResponse(doctors=stats_list)

    # Post-generation: check actual per-doctor hours against minimums
    for doc_stat in stats_list:
        if doc_stat.ac_hours < 135:
            warnings.append(
                f"{doc_stat.doctor_name} has {doc_stat.ac_hours}h AC, "
                f"below the 135h minimum."
            )
        if doc_stat.ap_hours < 425:
            warnings.append(
                f"{doc_stat.doctor_name} has {doc_stat.ap_hours}h AP, "
                f"below the 425h minimum."
            )

    return RotaSchedule(year=year, schedule=schedule, stats=stats, warnings=warnings)


def _check_feasibility(pool: list[DoctorIn], day_classifications: list[DayInfo]) -> list[str]:
    """Verify the pool can satisfy all constraints.

    Raises InfeasiblePoolError if the pool is too small (hard constraint).
    Returns a list of warning strings for soft constraint violations (e.g. minimum hours).
    """
    n = len(pool)

    if n < 2:
        raise InfeasiblePoolError(
            f"Pool must have at least 2 doctors (got {n}). "
            "Each day needs different doctors for AC and AP."
        )

    warnings: list[str] = []

    # Check minimum hours feasibility
    total_hours = sum(d.duration_hours for d in day_classifications)

    # Each doctor must get at least 135h AC. Total AC hours = total_hours.
    # If total_hours / n < 135, pool is too large for AC minimums.
    ac_hours_per_doctor = total_hours / n
    ap_hours_per_doctor = total_hours / n

    if ac_hours_per_doctor < 135:
        warnings.append(
            f"Pool of {n} doctors is large. "
            f"AC hours per doctor will be ~{ac_hours_per_doctor:.0f}h, "
            f"below the 135h minimum."
        )

    if ap_hours_per_doctor < 425:
        warnings.append(
            f"Pool of {n} doctors is large. "
            f"AP hours per doctor will be ~{ap_hours_per_doctor:.0f}h, "
            f"below the 425h minimum."
        )

    return warnings
