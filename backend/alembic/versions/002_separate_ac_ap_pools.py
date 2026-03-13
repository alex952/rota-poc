"""Separate AC/AP pools — add rota_type, doctors_per_day, restructure assignments

Revision ID: 002
Revises: 001
Create Date: 2026-03-13

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Rotas table: add rota_type and doctors_per_day ---
    op.add_column("rotas", sa.Column("rota_type", sa.String(length=2), nullable=True))
    op.add_column("rotas", sa.Column("doctors_per_day", sa.Integer(), nullable=True))

    # Backfill existing rows (treat them as AC)
    op.execute("UPDATE rotas SET rota_type = 'AC', doctors_per_day = 1 WHERE rota_type IS NULL")

    # Make columns non-nullable
    op.alter_column("rotas", "rota_type", nullable=False)
    op.alter_column("rotas", "doctors_per_day", nullable=False)

    # Drop old unique(year) — PostgreSQL auto-names it "rotas_year_key"
    op.drop_constraint("rotas_year_key", "rotas", type_="unique")
    op.create_unique_constraint("uq_rotas_year_rota_type", "rotas", ["year", "rota_type"])

    # --- Rota assignments: restructure from ac_doctor_id/ap_doctor_id to doctor_id ---
    op.add_column("rota_assignments", sa.Column("doctor_id", sa.String(length=50), nullable=True))

    # Backfill: copy ac_doctor_id into doctor_id for existing rows
    op.execute("UPDATE rota_assignments SET doctor_id = ac_doctor_id WHERE doctor_id IS NULL")

    op.alter_column("rota_assignments", "doctor_id", nullable=False)

    # Drop old indexes and constraints
    op.drop_index("ix_rota_assignments_ac_doctor", table_name="rota_assignments")
    op.drop_index("ix_rota_assignments_ap_doctor", table_name="rota_assignments")
    # PostgreSQL auto-names this "rota_assignments_rota_id_date_key"
    op.drop_constraint("rota_assignments_rota_id_date_key", "rota_assignments", type_="unique")

    # Drop old columns
    op.drop_column("rota_assignments", "ac_doctor_id")
    op.drop_column("rota_assignments", "ap_doctor_id")

    # Create new constraints and indexes
    op.create_unique_constraint(
        "uq_rota_assignments_rota_date_doctor",
        "rota_assignments",
        ["rota_id", "date", "doctor_id"],
    )
    op.create_index(
        "ix_rota_assignments_doctor",
        "rota_assignments",
        ["rota_id", "doctor_id"],
    )


def downgrade() -> None:
    # Reverse: add back ac_doctor_id, ap_doctor_id
    op.drop_index("ix_rota_assignments_doctor", table_name="rota_assignments")
    op.drop_constraint("uq_rota_assignments_rota_date_doctor", "rota_assignments", type_="unique")

    op.add_column("rota_assignments", sa.Column("ac_doctor_id", sa.String(length=50), nullable=True))
    op.add_column("rota_assignments", sa.Column("ap_doctor_id", sa.String(length=50), nullable=True))

    op.execute("UPDATE rota_assignments SET ac_doctor_id = doctor_id, ap_doctor_id = doctor_id")

    op.alter_column("rota_assignments", "ac_doctor_id", nullable=False)
    op.alter_column("rota_assignments", "ap_doctor_id", nullable=False)

    op.drop_column("rota_assignments", "doctor_id")

    op.create_unique_constraint("rota_assignments_rota_id_date_key", "rota_assignments", ["rota_id", "date"])
    op.create_index("ix_rota_assignments_ac_doctor", "rota_assignments", ["rota_id", "ac_doctor_id"])
    op.create_index("ix_rota_assignments_ap_doctor", "rota_assignments", ["rota_id", "ap_doctor_id"])

    # Reverse: remove rota_type and doctors_per_day from rotas
    op.drop_constraint("uq_rotas_year_rota_type", "rotas", type_="unique")
    op.create_unique_constraint("rotas_year_key", "rotas", ["year"])
    op.drop_column("rotas", "doctors_per_day")
    op.drop_column("rotas", "rota_type")
