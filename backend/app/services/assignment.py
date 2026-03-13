"""Assignment service — core scheduling algorithm.

Generates a typed rota (AC or AP) independently. Each rota type has its own
doctor pool, and the algorithm computes doctors_per_day from pool size and
minimum-hour constraints.
"""

import math
from datetime import date, timedelta
from typing import Literal

from app.schemas.rota import (
    DayAssignment,
    DayInfo,
    DoctorIn,
    DoctorRef,
    RotaSchedule,
    RotaType,
    StatsResponse,
)
from app.services.stats import calculate_stats


# Minimum hours constraints
AC_MIN_HOURS_YEAR = 1620  # 135h/month * 12
AP_MIN_HOURS_YEAR = 425


class InfeasiblePoolError(Exception):
    """Raised when the doctor pool cannot satisfy constraints."""
    pass



def _compute_doctors_per_day(
    rota_type: RotaType,
    pool_size: int,
    total_yearly_hours: int,
) -> int:
    """Compute how many doctors need to be assigned per day to meet minimum hours."""
    min_hours = AC_MIN_HOURS_YEAR if rota_type == "AC" else AP_MIN_HOURS_YEAR
    return math.ceil(pool_size * min_hours / total_yearly_hours)


def generate_rota(
    year: int,
    rota_type: RotaType,
    pool: list[DoctorIn],
    day_classifications: list[DayInfo],
) -> RotaSchedule:
    """Generate a full-year rota schedule for a single rota type.

    Algorithm (single-pass):
    1. Feasibility check
    2. Compute doctors_per_day from pool size and minimum hours
    3. For each day, assign doctors_per_day doctors, enforcing:
       - Rest-day after on-call (per rota type only) - soft for small pools
       - Sparsity: maximize gap between consecutive assignments
       - Equity: balance day-type counts and hours across doctors
    4. Post-generation hard validation of minimum hours
    5. Return schedule + stats
    """
    n_doctors = len(pool)
    total_yearly_hours = sum(d.duration_hours for d in day_classifications)

    # --- Feasibility check ---
    min_hours = AC_MIN_HOURS_YEAR if rota_type == "AC" else AP_MIN_HOURS_YEAR
    if n_doctors < 1:
        raise InfeasiblePoolError(
            f"Pool must have at least 1 doctor (got {n_doctors})."
        )

    doctors_per_day = _compute_doctors_per_day(rota_type, n_doctors, total_yearly_hours)

    # Need enough doctors for rotation: at least doctors_per_day * 2
    # (so that rest-day rotation is possible)
    min_pool = doctors_per_day * 2
    if n_doctors < min_pool:
        raise InfeasiblePoolError(
            f"Pool of {n_doctors} is too small for {rota_type}. "
            f"Need at least {min_pool} doctors ({doctors_per_day} per day × 2 for rest-day rotation)."
        )

    doctor_ids = [d.id for d in pool]
    doctor_map = {d.id: d for d in pool}

    # Tracking: last date assigned for each doctor (per this rota type)
    last_assigned: dict[str, date | None] = {did: None for did in doctor_ids}

    # Per-doctor hour counter
    hours: dict[str, int] = {did: 0 for did in doctor_ids}

    # Per-doctor, per-day-type counters for equity
    weekday_count: dict[str, int] = {did: 0 for did in doctor_ids}
    saturday_count: dict[str, int] = {did: 0 for did in doctor_ids}
    holiday_count: dict[str, int] = {did: 0 for did in doctor_ids}

    def _day_type_count(did: str, day_type: str) -> int:
        if day_type == "weekday":
            return weekday_count[did]
        elif day_type == "saturday":
            return saturday_count[did]
        else:
            return holiday_count[did]

    # Pre-compute doctor index lookup for O(1) access in sort key
    doctor_index = {did: i for i, did in enumerate(doctor_ids)}

    # Sliding round-robin pointer — advances by 1 each day to ensure
    # different subsets of equally-qualified doctors are selected,
    # breaking the cohort lock-in caused by rest-day synchronization.
    rr_pointer = 0

    # -----------------------------------------------------------------------
    # Single pass: Assign doctors_per_day doctors for each day
    # -----------------------------------------------------------------------
    schedule: list[DayAssignment] = []

    for day_info in day_classifications:
        d = day_info.date
        prev_day = d - timedelta(days=1)

        # Build eligible set: prefer doctors NOT assigned on D-1 (rest-day rule)
        rested = []
        unrested = []
        for did in doctor_ids:
            if last_assigned[did] == prev_day:
                unrested.append(did)
            else:
                rested.append(did)

        # If we have enough rested doctors, use only rested ones.
        # Otherwise, fall back to all doctors (rest-day becomes soft constraint).
        if len(rested) >= doctors_per_day:
            available_today = rested
        else:
            available_today = rested + unrested

        if len(available_today) < doctors_per_day:
            raise InfeasiblePoolError(
                f"Not enough eligible doctors on {d}. Pool is too small."
            )

        # Sort by: 1) fewest day-type shifts (equity),
        #          2) fewest total hours (behind-target first),
        #          3) round-robin position (varies each day to break cohorts)
        # The round-robin pointer advances by 1 daily, so different doctors
        # win ties on different days — preventing the same group from always
        # being selected together.
        available_sorted = sorted(
            available_today,
            key=lambda did: (
                _day_type_count(did, day_info.day_type),
                hours[did],
                (doctor_index[did] - rr_pointer) % n_doctors,
            )
        )

        chosen = available_sorted[:doctors_per_day]

        # Advance pointer by 1 each day for maximum group variation
        rr_pointer = (rr_pointer + 1) % n_doctors

        # --- Update tracking ---
        for did in chosen:
            last_assigned[did] = d
            hours[did] += day_info.duration_hours

            if day_info.day_type == "weekday":
                weekday_count[did] += 1
            elif day_info.day_type == "saturday":
                saturday_count[did] += 1
            else:
                holiday_count[did] += 1

        # --- Build day assignment ---
        schedule.append(
            DayAssignment(
                date=d,
                day_type=day_info.day_type,
                shift_start=day_info.shift_start,
                shift_end=day_info.shift_end,
                duration_hours=day_info.duration_hours,
                doctors=[
                    DoctorRef(
                        doctor_id=did,
                        doctor_name=doctor_map[did].name,
                    )
                    for did in chosen
                ],
            )
        )

    # -----------------------------------------------------------------------
    # Calculate stats
    # -----------------------------------------------------------------------
    stats_list = calculate_stats(schedule, pool)
    stats = StatsResponse(doctors=stats_list)

    # -----------------------------------------------------------------------
    # Post-generation HARD validation
    # -----------------------------------------------------------------------
    warnings: list[str] = []
    for doc_stat in stats_list:
        if doc_stat.total_hours < min_hours:
            raise InfeasiblePoolError(
                f"{doc_stat.doctor_name} has {doc_stat.total_hours}h, "
                f"below the {min_hours}h minimum for {rota_type}. "
                f"Pool size or constraints make this infeasible."
            )

    return RotaSchedule(
        year=year,
        rota_type=rota_type,
        doctors_per_day=doctors_per_day,
        schedule=schedule,
        stats=stats,
        warnings=warnings,
    )
