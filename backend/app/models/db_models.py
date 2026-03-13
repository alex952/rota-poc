from datetime import date, datetime, time

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Time,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Rota(Base):
    __tablename__ = "rotas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    rota_type: Mapped[str] = mapped_column(String(2), nullable=False)  # "AC" or "AP"
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    pool: Mapped[dict] = mapped_column(JSON, nullable=False)
    doctors_per_day: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    doctors: Mapped[list["RotaDoctor"]] = relationship(
        back_populates="rota", cascade="all, delete-orphan"
    )
    assignments: Mapped[list["RotaAssignment"]] = relationship(
        back_populates="rota", cascade="all, delete-orphan"
    )

    __table_args__ = (UniqueConstraint("year", "rota_type"),)


class RotaDoctor(Base):
    __tablename__ = "rota_doctors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    rota_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("rotas.id", ondelete="CASCADE"), nullable=False
    )
    doctor_id: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    department: Mapped[str] = mapped_column(String(200), nullable=False)

    rota: Mapped["Rota"] = relationship(back_populates="doctors")

    __table_args__ = (UniqueConstraint("rota_id", "doctor_id"),)


class RotaAssignment(Base):
    __tablename__ = "rota_assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    rota_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("rotas.id", ondelete="CASCADE"), nullable=False
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    day_type: Mapped[str] = mapped_column(String(20), nullable=False)
    shift_start: Mapped[time] = mapped_column(Time, nullable=False)
    shift_end: Mapped[time] = mapped_column(Time, nullable=False)
    duration_hours: Mapped[int] = mapped_column(Integer, nullable=False)
    doctor_id: Mapped[str] = mapped_column(String(50), nullable=False)

    rota: Mapped["Rota"] = relationship(back_populates="assignments")

    __table_args__ = (
        UniqueConstraint("rota_id", "date", "doctor_id"),
        Index("ix_rota_assignments_doctor", "rota_id", "doctor_id"),
    )


class Holiday(Base):
    __tablename__ = "holidays"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)

    __table_args__ = (
        UniqueConstraint("year", "city", "date"),
        Index("ix_holidays_year_city", "year", "city"),
    )
