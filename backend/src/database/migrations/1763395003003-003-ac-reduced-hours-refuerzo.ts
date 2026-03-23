import { MigrationInterface, QueryRunner } from 'typeorm';

export class AcReducedHoursRefuerzo0031763395003003 implements MigrationInterface {
  name = 'AcReducedHoursRefuerzo0031763395003003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rota_doctors
      ADD COLUMN IF NOT EXISTS hours_reduced_per_day INTEGER DEFAULT 0
    `);
    await queryRunner.query(`
      UPDATE rota_doctors
      SET hours_reduced_per_day = 0
      WHERE hours_reduced_per_day IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE rota_doctors
      ALTER COLUMN hours_reduced_per_day SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE rota_doctors
      ALTER COLUMN hours_reduced_per_day DROP DEFAULT
    `);

    await queryRunner.query(`
      ALTER TABLE rota_assignments
      ADD COLUMN IF NOT EXISTS assignment_kind VARCHAR(20) DEFAULT 'primary'
    `);
    await queryRunner.query(`
      ALTER TABLE rota_assignments
      ADD COLUMN IF NOT EXISTS linked_primary_doctor_id VARCHAR(50)
    `);
    await queryRunner.query(`
      UPDATE rota_assignments
      SET assignment_kind = 'primary'
      WHERE assignment_kind IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE rota_assignments
      ALTER COLUMN assignment_kind SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE rota_assignments
      ALTER COLUMN assignment_kind DROP DEFAULT
    `);

    await queryRunner.query(`
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
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'uq_rota_assignments_rota_date_doctor_kind'
        ) THEN
          ALTER TABLE rota_assignments
          ADD CONSTRAINT uq_rota_assignments_rota_date_doctor_kind
          UNIQUE (rota_id, date, doctor_id, assignment_kind);
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rota_assignments
      DROP CONSTRAINT IF EXISTS uq_rota_assignments_rota_date_doctor_kind
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'uq_rota_assignments_rota_date_doctor'
        ) THEN
          ALTER TABLE rota_assignments
          ADD CONSTRAINT uq_rota_assignments_rota_date_doctor
          UNIQUE (rota_id, date, doctor_id);
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`
      ALTER TABLE rota_assignments
      DROP COLUMN IF EXISTS linked_primary_doctor_id
    `);
    await queryRunner.query(`
      ALTER TABLE rota_assignments
      DROP COLUMN IF EXISTS assignment_kind
    `);
    await queryRunner.query(`
      ALTER TABLE rota_doctors
      DROP COLUMN IF EXISTS hours_reduced_per_day
    `);
  }
}
