"""Stats service — calculate per-doctor statistics from rota assignments."""

from app.schemas.rota import DayAssignment, DoctorIn, DoctorStats


def calculate_stats(
    schedule: list[DayAssignment], pool: list[DoctorIn]
) -> list[DoctorStats]:
    """Calculate per-doctor statistics from a schedule.

    Returns a list of DoctorStats, one per doctor in the pool.
    """
    doctor_map = {d.id: d for d in pool}

    # Initialize counters
    total_hours: dict[str, int] = {d.id: 0 for d in pool}
    monthly_hours: dict[str, dict[int, int]] = {d.id: {} for d in pool}
    shifts_weekday: dict[str, int] = {d.id: 0 for d in pool}
    shifts_saturday: dict[str, int] = {d.id: 0 for d in pool}
    shifts_sunday_holiday: dict[str, int] = {d.id: 0 for d in pool}

    for day in schedule:
        hours = day.duration_hours
        day_type = day.day_type
        month = day.date.month

        for doc_ref in day.doctors:
            did = doc_ref.doctor_id
            if did not in doctor_map:
                continue

            total_hours[did] += hours

            if month not in monthly_hours[did]:
                monthly_hours[did][month] = 0
            monthly_hours[did][month] += hours

            if day_type == "weekday":
                shifts_weekday[did] += 1
            elif day_type == "saturday":
                shifts_saturday[did] += 1
            else:  # "holiday"
                shifts_sunday_holiday[did] += 1

    result: list[DoctorStats] = []
    for doc in pool:
        did = doc.id
        result.append(
            DoctorStats(
                doctor_id=did,
                doctor_name=doc.name,
                total_hours=total_hours.get(did, 0),
                monthly_hours=monthly_hours.get(did, {}),
                shifts_weekday=shifts_weekday.get(did, 0),
                shifts_saturday=shifts_saturday.get(did, 0),
                shifts_sunday_holiday=shifts_sunday_holiday.get(did, 0),
            )
        )

    return result
