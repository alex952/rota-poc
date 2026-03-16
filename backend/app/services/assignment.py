"""Assignment service — core scheduling algorithm."""

import math
from collections import defaultdict
from datetime import date, timedelta

from app.schemas.rota import (
    DayAssignment,
    DayInfo,
    DoctorIn,
    DoctorRef,
    RefuerzoAssignment,
    RotaSchedule,
    RotaType,
    StatsResponse,
)
from app.services.stats import calculate_stats


AC_MIN_HOURS_YEAR = 1620
AC_BASE_MONTHLY_TARGET = 135
AP_MIN_HOURS_YEAR = 425

REFUERZO_WEEKDAY_SATURDAY_HOURS = 7
REFUERZO_HOLIDAY_HOURS = 12


class InfeasiblePoolError(Exception):
    """Raised when the doctor pool cannot satisfy constraints."""


def _compute_doctors_per_day(
    rota_type: RotaType,
    pool_size: int,
    total_yearly_hours: int,
    target_hours: dict[str, int] | None = None,
) -> int:
    """Compute how many doctors need to be assigned per day to meet minimum hours."""
    if target_hours:
        min_total_hours = sum(target_hours.values())
    else:
        min_hours = AC_MIN_HOURS_YEAR if rota_type == "AC" else AP_MIN_HOURS_YEAR
        min_total_hours = pool_size * min_hours
    return math.ceil(min_total_hours / total_yearly_hours)


def _build_target_hours(
    rota_type: RotaType,
    pool: list[DoctorIn],
    day_classifications: list[DayInfo],
) -> dict[str, int]:
    if rota_type != "AC":
        return {doctor.id: AP_MIN_HOURS_YEAR for doctor in pool}

    working_weekdays_per_month: dict[int, int] = defaultdict(int)
    for day in day_classifications:
        if day.day_type == "weekday":
            working_weekdays_per_month[day.date.month] += 1

    targets: dict[str, int] = {}
    for doctor in pool:
        yearly_target = 0
        for month in range(1, 13):
            monthly_target = AC_BASE_MONTHLY_TARGET - (
                doctor.hours_reduced_per_day * working_weekdays_per_month[month]
            )
            yearly_target += max(0, monthly_target)
        targets[doctor.id] = max(0, yearly_target)
    return targets


def _progress_ratio(hours: int, target: int) -> float:
    if target <= 0:
        return 1.0
    return hours / target


def _refuerzo_details(day_type: str) -> tuple[int, str, str]:
    if day_type == "holiday":
        return (REFUERZO_HOLIDAY_HOURS, "10:00", "22:00")
    return (REFUERZO_WEEKDAY_SATURDAY_HOURS, "15:00", "22:00")


def generate_rota(
    year: int,
    rota_type: RotaType,
    pool: list[DoctorIn],
    day_classifications: list[DayInfo],
) -> RotaSchedule:
    """Generate a full-year rota schedule for a single rota type."""
    n_doctors = len(pool)
    total_yearly_hours = sum(d.duration_hours for d in day_classifications)
    target_hours = _build_target_hours(rota_type, pool, day_classifications)

    if n_doctors < 1:
        raise InfeasiblePoolError(f"Pool must have at least 1 doctor (got {n_doctors}).")

    doctors_per_day = _compute_doctors_per_day(
        rota_type, n_doctors, total_yearly_hours, target_hours
    )

    min_pool = doctors_per_day * 2
    if n_doctors < min_pool:
        raise InfeasiblePoolError(
            f"Pool of {n_doctors} is too small for {rota_type}. "
            f"Need at least {min_pool} doctors ({doctors_per_day} per day × 2 for rest-day rotation)."
        )

    doctor_ids = [doctor.id for doctor in pool]
    doctor_map = {doctor.id: doctor for doctor in pool}
    doctor_index = {did: index for index, did in enumerate(doctor_ids)}

    last_assigned: dict[str, date | None] = {did: None for did in doctor_ids}
    total_hours: dict[str, int] = {did: 0 for did in doctor_ids}

    weekday_count: dict[str, int] = {did: 0 for did in doctor_ids}
    saturday_count: dict[str, int] = {did: 0 for did in doctor_ids}
    holiday_count: dict[str, int] = {did: 0 for did in doctor_ids}

    def _day_type_count(did: str, day_type: str) -> int:
        if day_type == "weekday":
            return weekday_count[did]
        if day_type == "saturday":
            return saturday_count[did]
        return holiday_count[did]

    rr_pointer = 0
    schedule: list[DayAssignment] = []

    for day_info in day_classifications:
        current_date = day_info.date
        prev_day = current_date - timedelta(days=1)

        rested: list[str] = []
        unrested: list[str] = []
        for did in doctor_ids:
            if last_assigned[did] == prev_day:
                unrested.append(did)
            else:
                rested.append(did)

        available_today = rested if len(rested) >= doctors_per_day else rested + unrested
        if len(available_today) < doctors_per_day:
            raise InfeasiblePoolError(
                f"Not enough eligible doctors on {current_date}. Pool is too small."
            )

        available_sorted = sorted(
            available_today,
            key=lambda did: (
                _day_type_count(did, day_info.day_type),
                _progress_ratio(total_hours[did], target_hours[did]),
                total_hours[did],
                (doctor_index[did] - rr_pointer) % n_doctors,
            ),
        )

        chosen = available_sorted[:doctors_per_day]
        rr_pointer = (rr_pointer + 1) % n_doctors

        for did in chosen:
            last_assigned[did] = current_date
            total_hours[did] += day_info.duration_hours
            if day_info.day_type == "weekday":
                weekday_count[did] += 1
            elif day_info.day_type == "saturday":
                saturday_count[did] += 1
            else:
                holiday_count[did] += 1

        schedule.append(
            DayAssignment(
                date=current_date,
                day_type=day_info.day_type,
                shift_start=day_info.shift_start,
                shift_end=day_info.shift_end,
                duration_hours=day_info.duration_hours,
                doctors=[
                    DoctorRef(doctor_id=did, doctor_name=doctor_map[did].name)
                    for did in chosen
                ],
                refuerzos=[],
            )
        )

    if rota_type == "AC":
        primary_by_date = {
            day.date: {doctor.doctor_id for doctor in day.doctors} for day in schedule
        }
        refuerzo_weekday_count: dict[str, int] = {did: 0 for did in doctor_ids}
        refuerzo_saturday_count: dict[str, int] = {did: 0 for did in doctor_ids}
        refuerzo_holiday_count: dict[str, int] = {did: 0 for did in doctor_ids}
        refuerzo_rr_pointer = 0
        refuerzo_by_date: dict[date, set[str]] = defaultdict(set)

        def _refuerzo_day_type_count(did: str, day_type: str) -> int:
            if day_type == "weekday":
                return refuerzo_weekday_count[did]
            if day_type == "saturday":
                return refuerzo_saturday_count[did]
            return refuerzo_holiday_count[did]

        for day in schedule:
            if len(day.doctors) != 1:
                continue

            reduced_primary_ids = [
                doctor.doctor_id
                for doctor in day.doctors
                if doctor_map[doctor.doctor_id].hours_reduced_per_day > 0
            ]
            if not reduced_primary_ids:
                continue

            prev_day = day.date - timedelta(days=1)
            same_day_taken = set(primary_by_date.get(day.date, set()))
            same_day_taken.update(refuerzo_by_date.get(day.date, set()))

            for primary_doctor_id in reduced_primary_ids:
                rested: list[str] = []
                unrested: list[str] = []
                prev_day_assigned = set(primary_by_date.get(prev_day, set()))
                prev_day_assigned.update(refuerzo_by_date.get(prev_day, set()))
                for did in doctor_ids:
                    if did in same_day_taken:
                        continue
                    if did in prev_day_assigned:
                        unrested.append(did)
                    else:
                        rested.append(did)

                available = rested if rested else rested + unrested
                if not available:
                    available = unrested
                if not available:
                    raise InfeasiblePoolError(
                        f"Not enough eligible doctors to cover refuerzo on {day.date}."
                    )

                available_sorted = sorted(
                    available,
                    key=lambda did: (
                        _progress_ratio(total_hours[did], target_hours[did]),
                        _refuerzo_day_type_count(did, day.day_type),
                        total_hours[did],
                        (doctor_index[did] - refuerzo_rr_pointer) % n_doctors,
                    ),
                )
                chosen = available_sorted[0]
                refuerzo_rr_pointer = (refuerzo_rr_pointer + 1) % n_doctors

                duration_hours, shift_start, shift_end = _refuerzo_details(day.day_type)
                day.refuerzos.append(
                    RefuerzoAssignment(
                        doctor_id=chosen,
                        doctor_name=doctor_map[chosen].name,
                        linked_primary_doctor_id=primary_doctor_id,
                        linked_primary_doctor_name=doctor_map[primary_doctor_id].name,
                        shift_start=shift_start,
                        shift_end=shift_end,
                        duration_hours=duration_hours,
                    )
                )

                refuerzo_by_date[day.date].add(chosen)
                same_day_taken.add(chosen)
                total_hours[chosen] += duration_hours
                if day.day_type == "weekday":
                    refuerzo_weekday_count[chosen] += 1
                elif day.day_type == "saturday":
                    refuerzo_saturday_count[chosen] += 1
                else:
                    refuerzo_holiday_count[chosen] += 1

    stats_list = calculate_stats(schedule, pool, target_hours)
    stats = StatsResponse(doctors=stats_list)

    for doc_stat in stats_list:
        if doc_stat.total_hours < doc_stat.target_hours:
            raise InfeasiblePoolError(
                f"{doc_stat.doctor_name} has {doc_stat.total_hours}h, "
                f"below the {doc_stat.target_hours}h minimum for {rota_type}."
            )

    return RotaSchedule(
        year=year,
        rota_type=rota_type,
        doctors_per_day=doctors_per_day,
        schedule=schedule,
        stats=stats,
        warnings=[],
    )
