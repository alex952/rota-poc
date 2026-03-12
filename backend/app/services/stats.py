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
    ac_hours: dict[str, int] = {d.id: 0 for d in pool}
    ap_hours: dict[str, int] = {d.id: 0 for d in pool}
    shifts_weekday: dict[str, int] = {d.id: 0 for d in pool}
    shifts_saturday: dict[str, int] = {d.id: 0 for d in pool}
    shifts_sunday_holiday: dict[str, int] = {d.id: 0 for d in pool}

    for day in schedule:
        ac_id = day.atencion_continuada.doctor_id
        ap_id = day.atencion_primaria.doctor_id
        hours = day.duration_hours
        day_type = day.day_type

        # AC hours
        if ac_id in ac_hours:
            ac_hours[ac_id] += hours
        # AP hours
        if ap_id in ap_hours:
            ap_hours[ap_id] += hours

        # Shift counts — count per assignment (a doctor gets counted for
        # each service type they're assigned on a given day type)
        for did in (ac_id, ap_id):
            if did not in doctor_map:
                continue
            if day_type == "weekday":
                shifts_weekday[did] += 1
            elif day_type == "saturday":
                shifts_saturday[did] += 1
            else:  # "holiday"
                shifts_sunday_holiday[did] += 1

    result: list[DoctorStats] = []
    for doc in pool:
        did = doc.id
        total = ac_hours.get(did, 0) + ap_hours.get(did, 0)
        result.append(
            DoctorStats(
                doctor_id=did,
                doctor_name=doc.name,
                total_hours=total,
                ac_hours=ac_hours.get(did, 0),
                ap_hours=ap_hours.get(did, 0),
                shifts_weekday=shifts_weekday.get(did, 0),
                shifts_saturday=shifts_saturday.get(did, 0),
                shifts_sunday_holiday=shifts_sunday_holiday.get(did, 0),
            )
        )

    return result
