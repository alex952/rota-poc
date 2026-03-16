"""Rota API endpoints — generate, query, replace."""

from datetime import datetime, time, timezone
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.db.session import get_db
from app.models.db_models import Rota, RotaAssignment, RotaDoctor
from app.schemas.rota import (
    DayAssignment,
    DoctorIn,
    DoctorRef,
    GenerateRequest,
    RefuerzoAssignment,
    ReplaceRequest,
    RotaResponse,
    RotaType,
    StatsResponse,
)
from app.services.assignment import InfeasiblePoolError, _build_target_hours, generate_rota
from app.services.holidays import classify_year, get_holidays
from app.services.stats import calculate_stats

router = APIRouter(prefix="/rota", tags=["rota"])


def _build_rota_response(
    rota: Rota, db: Session, doctor_id_filter: str | None = None
) -> RotaResponse:
    """Build a RotaResponse from a Rota DB model."""
    pool_data = rota.pool
    pool = [DoctorIn(**d) for d in pool_data]
    doctor_map = {d.id: d for d in pool}
    target_hours = _build_target_hours(rota.rota_type, pool, classify_year(rota.year, {h.date for h in get_holidays(rota.year, rota.city, db)}))

    assignments = (
        db.query(RotaAssignment)
        .filter(RotaAssignment.rota_id == rota.id)
        .order_by(RotaAssignment.date)
        .all()
    )

    if doctor_id_filter:
        assignments = [
            a for a in assignments if a.doctor_id == doctor_id_filter
        ]

    # Group assignment rows by date to build DayAssignment with doctors + refuerzos
    date_groups: dict[str, list] = defaultdict(list)
    date_meta: dict[str, dict] = {}
    for a in assignments:
        date_key = a.date.isoformat()
        date_groups[date_key].append(a)
        if date_key not in date_meta:
            date_meta[date_key] = {
                "date": a.date,
                "day_type": a.day_type,
                "shift_start": a.shift_start,
                "shift_end": a.shift_end,
                "duration_hours": a.duration_hours,
            }

    schedule: list[DayAssignment] = []
    for date_key in sorted(date_groups.keys()):
        rows = date_groups[date_key]
        meta = date_meta[date_key]
        doctors = []
        refuerzos = []
        for a in rows:
            doc = doctor_map.get(a.doctor_id)
            if a.assignment_kind == "refuerzo":
                linked_doc = doctor_map.get(a.linked_primary_doctor_id)
                refuerzos.append(
                    RefuerzoAssignment(
                        doctor_id=a.doctor_id,
                        doctor_name=doc.name if doc else a.doctor_id,
                        linked_primary_doctor_id=a.linked_primary_doctor_id,
                        linked_primary_doctor_name=(
                            linked_doc.name if linked_doc else a.linked_primary_doctor_id
                        ),
                        shift_start=a.shift_start.strftime("%H:%M"),
                        shift_end=a.shift_end.strftime("%H:%M"),
                        duration_hours=a.duration_hours,
                    )
                )
            else:
                doctors.append(
                    DoctorRef(
                        doctor_id=a.doctor_id,
                        doctor_name=doc.name if doc else a.doctor_id,
                    )
                )
        shift_start = meta["shift_start"]
        if isinstance(shift_start, time):
            shift_start = shift_start.strftime("%H:%M")
        schedule.append(
            DayAssignment(
                date=meta["date"],
                day_type=meta["day_type"],
                shift_start=shift_start,
                shift_end=_format_shift_end(meta["shift_end"], meta["day_type"]),
                duration_hours=meta["duration_hours"],
                doctors=doctors,
                refuerzos=refuerzos,
            )
        )

    # Recalculate stats from ALL assignments (not filtered) for accuracy
    all_assignments = (
        db.query(RotaAssignment)
        .filter(RotaAssignment.rota_id == rota.id)
        .order_by(RotaAssignment.date)
        .all()
    )

    all_date_groups: dict[str, list] = defaultdict(list)
    all_date_meta: dict[str, dict] = {}
    for a in all_assignments:
        date_key = a.date.isoformat()
        all_date_groups[date_key].append(a)
        if date_key not in all_date_meta:
            all_date_meta[date_key] = {
                "date": a.date,
                "day_type": a.day_type,
                "shift_start": a.shift_start,
                "shift_end": a.shift_end,
                "duration_hours": a.duration_hours,
            }

    all_schedule: list[DayAssignment] = []
    for date_key in sorted(all_date_groups.keys()):
        rows = all_date_groups[date_key]
        meta = all_date_meta[date_key]
        doctors = []
        refuerzos = []
        for a in rows:
            doc = doctor_map.get(a.doctor_id)
            if a.assignment_kind == "refuerzo":
                linked_doc = doctor_map.get(a.linked_primary_doctor_id)
                refuerzos.append(
                    RefuerzoAssignment(
                        doctor_id=a.doctor_id,
                        doctor_name=doc.name if doc else a.doctor_id,
                        linked_primary_doctor_id=a.linked_primary_doctor_id,
                        linked_primary_doctor_name=(
                            linked_doc.name if linked_doc else a.linked_primary_doctor_id
                        ),
                        shift_start=a.shift_start.strftime("%H:%M"),
                        shift_end=a.shift_end.strftime("%H:%M"),
                        duration_hours=a.duration_hours,
                    )
                )
            else:
                doctors.append(
                    DoctorRef(
                        doctor_id=a.doctor_id,
                        doctor_name=doc.name if doc else a.doctor_id,
                    )
                )
        shift_start = meta["shift_start"]
        if isinstance(shift_start, time):
            shift_start = shift_start.strftime("%H:%M")
        all_schedule.append(
            DayAssignment(
                date=meta["date"],
                day_type=meta["day_type"],
                shift_start=shift_start,
                shift_end=_format_shift_end(meta["shift_end"], meta["day_type"]),
                duration_hours=meta["duration_hours"],
                doctors=doctors,
                refuerzos=refuerzos,
            )
        )

    stats_list = calculate_stats(all_schedule, pool, target_hours)

    return RotaResponse(
        year=rota.year,
        city=rota.city,
        rota_type=rota.rota_type,
        doctors_per_day=rota.doctors_per_day,
        generated_at=rota.generated_at,
        schedule=schedule,
        stats=StatsResponse(doctors=stats_list),
    )


def _format_shift_end(shift_end, day_type: str) -> str:
    """Format shift_end with +1 suffix for next-day times."""
    if isinstance(shift_end, time):
        formatted = shift_end.strftime("%H:%M")
    else:
        formatted = str(shift_end)
    # All on-call shifts end the next day
    return formatted + "+1"


def _parse_time(t_str: str) -> time:
    """Parse a time string like '15:00' or '08:00+1' to a time object."""
    clean = t_str.replace("+1", "")
    parts = clean.split(":")
    return time(int(parts[0]), int(parts[1]))


@router.post("/generate", response_model=RotaResponse, status_code=201)
def generate_rota_endpoint(request: GenerateRequest, db: Session = Depends(get_db)):
    """Generate a new rota for the given year, rota type, and doctor pool."""
    city = settings.CITY

    # Fetch holidays
    try:
        holiday_items = get_holidays(request.year, city, db)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Holiday API error: {e}")

    holiday_dates = {h.date for h in holiday_items}

    # Classify days
    day_classifications = classify_year(request.year, holiday_dates)

    # Generate rota
    try:
        rota_result = generate_rota(
            request.year, request.rota_type, request.pool, day_classifications
        )
    except InfeasiblePoolError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Delete existing rota for this year + rota_type (replace)
    existing = (
        db.query(Rota)
        .filter(Rota.year == request.year, Rota.rota_type == request.rota_type)
        .first()
    )
    if existing:
        db.delete(existing)
        db.flush()

    # Persist new rota
    now = datetime.now(timezone.utc)
    rota_db = Rota(
        year=request.year,
        rota_type=request.rota_type,
        city=city,
        generated_at=now,
        pool=[d.model_dump() for d in request.pool],
        doctors_per_day=rota_result.doctors_per_day,
    )
    db.add(rota_db)
    db.flush()  # get rota_db.id

    # Persist doctors
    for doc in request.pool:
        db.add(
            RotaDoctor(
                rota_id=rota_db.id,
                doctor_id=doc.id,
                name=doc.name,
                department=doc.department,
                hours_reduced_per_day=doc.hours_reduced_per_day,
            )
        )

    # Persist assignments — one row per doctor per day
    for day in rota_result.schedule:
        for doc_ref in day.doctors:
            db.add(
                RotaAssignment(
                    rota_id=rota_db.id,
                    date=day.date,
                    day_type=day.day_type,
                    shift_start=_parse_time(day.shift_start),
                    shift_end=_parse_time(day.shift_end),
                    duration_hours=day.duration_hours,
                    doctor_id=doc_ref.doctor_id,
                    assignment_kind="primary",
                    linked_primary_doctor_id=None,
                )
            )
        for refuerzo in day.refuerzos:
            db.add(
                RotaAssignment(
                    rota_id=rota_db.id,
                    date=day.date,
                    day_type=day.day_type,
                    shift_start=_parse_time(refuerzo.shift_start),
                    shift_end=_parse_time(refuerzo.shift_end),
                    duration_hours=refuerzo.duration_hours,
                    doctor_id=refuerzo.doctor_id,
                    assignment_kind="refuerzo",
                    linked_primary_doctor_id=refuerzo.linked_primary_doctor_id,
                )
            )

    db.commit()
    db.refresh(rota_db)

    response = _build_rota_response(rota_db, db)
    response.warnings = rota_result.warnings
    return response


@router.get("/{year}/{rota_type}", response_model=RotaResponse)
def get_rota_by_type(
    year: int,
    rota_type: RotaType,
    doctor_id: str | None = None,
    db: Session = Depends(get_db),
):
    """Retrieve the stored rota for a given year and rota type."""
    rota = (
        db.query(Rota)
        .filter(Rota.year == year, Rota.rota_type == rota_type)
        .first()
    )
    if not rota:
        raise HTTPException(
            status_code=404,
            detail=f"No {rota_type} rota found for year {year}",
        )

    return _build_rota_response(rota, db, doctor_id_filter=doctor_id)


@router.get("/{year}", response_model=list[RotaResponse])
def get_rotas(year: int, db: Session = Depends(get_db)):
    """Retrieve all rotas (AC and AP) for a given year."""
    rotas = db.query(Rota).filter(Rota.year == year).all()
    if not rotas:
        raise HTTPException(status_code=404, detail=f"No rotas found for year {year}")

    return [_build_rota_response(r, db) for r in rotas]


@router.patch("/{year}/{rota_type}/replace", response_model=RotaResponse)
def replace_doctor(
    year: int,
    rota_type: RotaType,
    request: ReplaceRequest,
    db: Session = Depends(get_db),
):
    """Replace a doctor assignment on a specific date."""
    rota = (
        db.query(Rota)
        .filter(Rota.year == year, Rota.rota_type == rota_type)
        .first()
    )
    if not rota:
        raise HTTPException(
            status_code=404,
            detail=f"No {rota_type} rota found for year {year}",
        )

    # Verify new_doctor_id is in the pool
    pool_ids = {d["id"] for d in rota.pool}
    if request.new_doctor_id not in pool_ids:
        raise HTTPException(
            status_code=400,
            detail=f"Doctor {request.new_doctor_id} is not in the original pool.",
        )

    # Find the assignment row for the old doctor on that date
    assignment = (
        db.query(RotaAssignment)
        .filter(
            RotaAssignment.rota_id == rota.id,
            RotaAssignment.date == request.date,
            RotaAssignment.doctor_id == request.old_doctor_id,
            RotaAssignment.assignment_kind == request.assignment_kind,
        )
        .first()
    )

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Doctor {request.old_doctor_id} is not assigned as "
                f"{request.assignment_kind} on {request.date}."
            ),
        )

    assignment.doctor_id = request.new_doctor_id

    db.commit()
    db.refresh(assignment)

    return _build_rota_response(rota, db)
