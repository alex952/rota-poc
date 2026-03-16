from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel


RotaType = Literal["AC", "AP"]
AssignmentKind = Literal["primary", "refuerzo"]

# --- Request schemas ---


class DoctorIn(BaseModel):
    id: str
    name: str
    department: str
    hours_reduced_per_day: int = 0


class GenerateRequest(BaseModel):
    year: int
    rota_type: RotaType
    pool: list[DoctorIn]


class ReplaceRequest(BaseModel):
    date: date
    old_doctor_id: str
    new_doctor_id: str
    assignment_kind: AssignmentKind = "primary"


# --- Response schemas ---


class DoctorRef(BaseModel):
    doctor_id: str
    doctor_name: str


class RefuerzoAssignment(BaseModel):
    doctor_id: str
    doctor_name: str
    linked_primary_doctor_id: str
    linked_primary_doctor_name: str
    shift_start: str
    shift_end: str
    duration_hours: int


class DayAssignment(BaseModel):
    date: date
    day_type: str  # "weekday", "saturday", "holiday"
    shift_start: str  # e.g. "15:00"
    shift_end: str  # e.g. "08:00+1"
    duration_hours: int
    doctors: list[DoctorRef]
    refuerzos: list[RefuerzoAssignment] = []


class DoctorStats(BaseModel):
    doctor_id: str
    doctor_name: str
    total_hours: int
    target_hours: int
    hours_vs_target: int
    primary_hours: int
    refuerzo_hours: int
    monthly_hours: dict[int, int]  # month number -> hours
    shifts_weekday: int
    shifts_saturday: int
    shifts_sunday_holiday: int


class StatsResponse(BaseModel):
    doctors: list[DoctorStats]


class RotaResponse(BaseModel):
    year: int
    city: str
    rota_type: RotaType
    doctors_per_day: int
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
    rota_type: RotaType
    doctors_per_day: int
    schedule: list[DayAssignment]
    stats: StatsResponse
    warnings: list[str] = []
