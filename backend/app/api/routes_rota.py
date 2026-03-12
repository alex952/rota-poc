"""Rota API endpoints — generate, query, replace."""

from datetime import datetime, time, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.db.session import get_db
from app.models.db_models import Rota, RotaAssignment, RotaDoctor
from app.schemas.rota import (
    DayAssignment,
    DoctorIn,
    DoctorRef,
    DoctorStats,
    GenerateRequest,
    ReplaceRequest,
    RotaResponse,
    StatsResponse,
)
from app.services.assignment import InfeasiblePoolError, generate_rota
from app.services.holidays import classify_year, get_holidays
from app.services.stats import calculate_stats

router = APIRouter(prefix="/rota", tags=["rota"])


def _build_rota_response(rota: Rota, db: Session, doctor_id_filter: str | None = None) -> RotaResponse:
    """Build a RotaResponse from a Rota DB model."""
    pool_data = rota.pool
    pool = [DoctorIn(**d) for d in pool_data]
    doctor_map = {d.id: d for d in pool}

    assignments = (
        db.query(RotaAssignment)
        .filter(RotaAssignment.rota_id == rota.id)
        .order_by(RotaAssignment.date)
        .all()
    )

    if doctor_id_filter:
        assignments = [
            a for a in assignments
            if a.ac_doctor_id == doctor_id_filter or a.ap_doctor_id == doctor_id_filter
        ]

    schedule: list[DayAssignment] = []
    for a in assignments:
        ac_doc = doctor_map.get(a.ac_doctor_id)
        ap_doc = doctor_map.get(a.ap_doctor_id)
        schedule.append(
            DayAssignment(
                date=a.date,
                day_type=a.day_type,
                shift_start=a.shift_start.strftime("%H:%M") if isinstance(a.shift_start, time) else a.shift_start,
                shift_end=_format_shift_end(a.shift_end, a.day_type),
                duration_hours=a.duration_hours,
                atencion_continuada=DoctorRef(
                    doctor_id=a.ac_doctor_id,
                    doctor_name=ac_doc.name if ac_doc else a.ac_doctor_id,
                ),
                atencion_primaria=DoctorRef(
                    doctor_id=a.ap_doctor_id,
                    doctor_name=ap_doc.name if ap_doc else a.ap_doctor_id,
                ),
            )
        )

    # Recalculate stats from ALL assignments (not filtered) for accuracy
    all_assignments = (
        db.query(RotaAssignment)
        .filter(RotaAssignment.rota_id == rota.id)
        .order_by(RotaAssignment.date)
        .all()
    )
    all_schedule: list[DayAssignment] = []
    for a in all_assignments:
        ac_doc = doctor_map.get(a.ac_doctor_id)
        ap_doc = doctor_map.get(a.ap_doctor_id)
        all_schedule.append(
            DayAssignment(
                date=a.date,
                day_type=a.day_type,
                shift_start=a.shift_start.strftime("%H:%M") if isinstance(a.shift_start, time) else a.shift_start,
                shift_end=_format_shift_end(a.shift_end, a.day_type),
                duration_hours=a.duration_hours,
                atencion_continuada=DoctorRef(
                    doctor_id=a.ac_doctor_id,
                    doctor_name=ac_doc.name if ac_doc else a.ac_doctor_id,
                ),
                atencion_primaria=DoctorRef(
                    doctor_id=a.ap_doctor_id,
                    doctor_name=ap_doc.name if ap_doc else a.ap_doctor_id,
                ),
            )
        )

    stats_list = calculate_stats(all_schedule, pool)

    return RotaResponse(
        year=rota.year,
        city=rota.city,
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
    """Generate a new rota for the given year and doctor pool."""
    if len(request.pool) < 2:
        raise HTTPException(
            status_code=400,
            detail="Pool must have at least 2 doctors.",
        )

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
        rota_result = generate_rota(request.year, request.pool, day_classifications)
    except InfeasiblePoolError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Delete existing rota for this year (replace)
    existing = db.query(Rota).filter(Rota.year == request.year).first()
    if existing:
        db.delete(existing)
        db.flush()

    # Persist new rota
    now = datetime.now(timezone.utc)
    rota_db = Rota(
        year=request.year,
        city=city,
        generated_at=now,
        pool=[d.model_dump() for d in request.pool],
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
            )
        )

    # Persist assignments
    for day in rota_result.schedule:
        db.add(
            RotaAssignment(
                rota_id=rota_db.id,
                date=day.date,
                day_type=day.day_type,
                shift_start=_parse_time(day.shift_start),
                shift_end=_parse_time(day.shift_end),
                duration_hours=day.duration_hours,
                ac_doctor_id=day.atencion_continuada.doctor_id,
                ap_doctor_id=day.atencion_primaria.doctor_id,
            )
        )

    db.commit()
    db.refresh(rota_db)

    response = _build_rota_response(rota_db, db)
    response.warnings = rota_result.warnings
    return response


@router.get("/{year}", response_model=RotaResponse)
def get_rota(year: int, doctor_id: str | None = None, db: Session = Depends(get_db)):
    """Retrieve the stored rota for a given year."""
    rota = db.query(Rota).filter(Rota.year == year).first()
    if not rota:
        raise HTTPException(status_code=404, detail=f"No rota found for year {year}")

    return _build_rota_response(rota, db, doctor_id_filter=doctor_id)


@router.patch("/{year}/replace", response_model=RotaResponse)
def replace_doctor(year: int, request: ReplaceRequest, db: Session = Depends(get_db)):
    """Replace a doctor assignment on a specific date and service type."""
    rota = db.query(Rota).filter(Rota.year == year).first()
    if not rota:
        raise HTTPException(status_code=404, detail=f"No rota found for year {year}")

    # Verify new_doctor_id is in the pool
    pool_ids = {d["id"] for d in rota.pool}
    if request.new_doctor_id not in pool_ids:
        raise HTTPException(
            status_code=400,
            detail=f"Doctor {request.new_doctor_id} is not in the original pool.",
        )

    # Find the assignment
    assignment = (
        db.query(RotaAssignment)
        .filter(
            RotaAssignment.rota_id == rota.id,
            RotaAssignment.date == request.date,
        )
        .first()
    )

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail=f"No assignment found for date {request.date}.",
        )

    # Verify old doctor matches
    if request.service_type == "atencion_continuada":
        if assignment.ac_doctor_id != request.old_doctor_id:
            raise HTTPException(
                status_code=404,
                detail=f"Doctor {request.old_doctor_id} is not assigned AC on {request.date}.",
            )
        assignment.ac_doctor_id = request.new_doctor_id
    elif request.service_type == "atencion_primaria":
        if assignment.ap_doctor_id != request.old_doctor_id:
            raise HTTPException(
                status_code=404,
                detail=f"Doctor {request.old_doctor_id} is not assigned AP on {request.date}.",
            )
        assignment.ap_doctor_id = request.new_doctor_id
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid service_type: {request.service_type}. "
            "Must be 'atencion_continuada' or 'atencion_primaria'.",
        )

    db.commit()
    db.refresh(assignment)

    return _build_rota_response(rota, db)
