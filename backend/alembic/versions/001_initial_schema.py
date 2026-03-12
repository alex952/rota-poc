"""Initial schema — rotas, rota_doctors, rota_assignments, holidays

Revision ID: 001
Revises:
Create Date: 2026-03-12

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Rotas table
    op.create_table(
        "rotas",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("city", sa.String(length=100), nullable=False),
        sa.Column(
            "generated_at", sa.DateTime(timezone=True), nullable=False
        ),
        sa.Column("pool", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("year"),
    )

    # Rota doctors table
    op.create_table(
        "rota_doctors",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("rota_id", sa.Integer(), nullable=False),
        sa.Column("doctor_id", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("department", sa.String(length=200), nullable=False),
        sa.ForeignKeyConstraint(
            ["rota_id"], ["rotas.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("rota_id", "doctor_id"),
    )

    # Rota assignments table
    op.create_table(
        "rota_assignments",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("rota_id", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("day_type", sa.String(length=20), nullable=False),
        sa.Column("shift_start", sa.Time(), nullable=False),
        sa.Column("shift_end", sa.Time(), nullable=False),
        sa.Column("duration_hours", sa.Integer(), nullable=False),
        sa.Column("ac_doctor_id", sa.String(length=50), nullable=False),
        sa.Column("ap_doctor_id", sa.String(length=50), nullable=False),
        sa.ForeignKeyConstraint(
            ["rota_id"], ["rotas.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("rota_id", "date"),
    )
    op.create_index(
        "ix_rota_assignments_ac_doctor",
        "rota_assignments",
        ["rota_id", "ac_doctor_id"],
    )
    op.create_index(
        "ix_rota_assignments_ap_doctor",
        "rota_assignments",
        ["rota_id", "ap_doctor_id"],
    )

    # Holidays table
    op.create_table(
        "holidays",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("city", sa.String(length=100), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("year", "city", "date"),
    )
    op.create_index("ix_holidays_year_city", "holidays", ["year", "city"])


def downgrade() -> None:
    op.drop_index("ix_holidays_year_city", table_name="holidays")
    op.drop_table("holidays")
    op.drop_index("ix_rota_assignments_ap_doctor", table_name="rota_assignments")
    op.drop_index("ix_rota_assignments_ac_doctor", table_name="rota_assignments")
    op.drop_table("rota_assignments")
    op.drop_table("rota_doctors")
    op.drop_table("rotas")
