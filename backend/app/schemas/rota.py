from datetime import date, datetime

from pydantic import BaseModel


# --- Request schemas ---


class DoctorIn(BaseModel):
    id: str
    name: str
    department: str


class GenerateRequest(BaseModel):
    year: int
    pool: list[DoctorIn]


class ReplaceRequest(BaseModel):
    date: date
    service_type: str  # "atencion_continuada" or "atencion_primaria"
    old_doctor_id: str
    new_doctor_id: str


# --- Response schemas ---


class DoctorRef(BaseModel):
    doctor_id: str
    doctor_name: str


class DayAssignment(BaseModel):
    date: date
    day_type: str  # "weekday", "saturday", "holiday"
    shift_start: str  # e.g. "15:00"
    shift_end: str  # e.g. "08:00+1"
    duration_hours: int
    atencion_continuada: DoctorRef
    atencion_primaria: DoctorRef


class DoctorStats(BaseModel):
    doctor_id: str
    doctor_name: str
    total_hours: int
    ac_hours: int
    ap_hours: int
    shifts_weekday: int
    shifts_saturday: int
    shifts_sunday_holiday: int


class StatsResponse(BaseModel):
    doctors: list[DoctorStats]


class RotaResponse(BaseModel):
    year: int
    city: str
    generated_at: datetime
    schedule: list[DayAssignment]
    stats: StatsResponse
    warnings: list[str] = []


class ConfigResponse(BaseModel):
    city: str


class HolidayItem(BaseModel):
    date: date
    name: str


class HolidaysResponse(BaseModel):
    year: int
    city: str
    holidays: list[HolidayItem]


class DayInfo(BaseModel):
    """Classification of a single calendar day."""

    date: date
    day_type: str  # "weekday", "saturday", "holiday"
    duration_hours: int
    shift_start: str
    shift_end: str


class RotaSchedule(BaseModel):
    """Full schedule output from the assignment algorithm."""

    year: int
    schedule: list[DayAssignment]
    stats: StatsResponse
    warnings: list[str] = []
