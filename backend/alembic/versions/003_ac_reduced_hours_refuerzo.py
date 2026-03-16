"""Add AC reduced-hours and refuerzo fields.

Revision ID: 003
Revises: 002
Create Date: 2026-03-16
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "rota_doctors",
        sa.Column("hours_reduced_per_day", sa.Integer(), nullable=True, server_default="0"),
    )
    op.execute(
        "UPDATE rota_doctors SET hours_reduced_per_day = 0 WHERE hours_reduced_per_day IS NULL"
    )
    op.alter_column("rota_doctors", "hours_reduced_per_day", nullable=False, server_default=None)

    op.add_column(
        "rota_assignments",
        sa.Column("assignment_kind", sa.String(length=20), nullable=True, server_default="primary"),
    )
    op.add_column(
        "rota_assignments",
        sa.Column("linked_primary_doctor_id", sa.String(length=50), nullable=True),
    )
    op.execute(
        "UPDATE rota_assignments SET assignment_kind = 'primary' WHERE assignment_kind IS NULL"
    )
    op.alter_column("rota_assignments", "assignment_kind", nullable=False, server_default=None)

    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'uq_rota_assignments_rota_date_doctor'
            ) THEN
                ALTER TABLE rota_assignments
                DROP CONSTRAINT uq_rota_assignments_rota_date_doctor;
            ELSIF EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'rota_assignments_rota_id_date_doctor_id_key'
            ) THEN
                ALTER TABLE rota_assignments
                DROP CONSTRAINT rota_assignments_rota_id_date_doctor_id_key;
            END IF;
        END
        $$;
        """
    )
    op.create_unique_constraint(
        "uq_rota_assignments_rota_date_doctor_kind",
        "rota_assignments",
        ["rota_id", "date", "doctor_id", "assignment_kind"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_rota_assignments_rota_date_doctor_kind", "rota_assignments", type_="unique")
    op.create_unique_constraint(
        "uq_rota_assignments_rota_date_doctor",
        "rota_assignments",
        ["rota_id", "date", "doctor_id"],
    )
    op.drop_column("rota_assignments", "linked_primary_doctor_id")
    op.drop_column("rota_assignments", "assignment_kind")
    op.drop_column("rota_doctors", "hours_reduced_per_day")
