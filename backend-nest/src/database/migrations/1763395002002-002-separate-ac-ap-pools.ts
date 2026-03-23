import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeparateAcApPools0021763395002002 implements MigrationInterface {
  name = 'SeparateAcApPools0021763395002002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rotas
      ADD COLUMN IF NOT EXISTS rota_type VARCHAR(2)
    `);
    await queryRunner.query(`
      ALTER TABLE rotas
      ADD COLUMN IF NOT EXISTS doctors_per_day INTEGER
    `);
    await queryRunner.query(`
      UPDATE rotas
      SET rota_type = 'AC', doctors_per_day = 1
      WHERE rota_type IS NULL OR doctors_per_day IS NULL
    `);
    await queryRunner.query(`ALTER TABLE rotas ALTER COLUMN rota_type SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE rotas ALTER COLUMN doctors_per_day SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE rotas DROP CONSTRAINT IF EXISTS rotas_year_key`);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'uq_rotas_year_rota_type'
        ) THEN
          ALTER TABLE rotas
          ADD CONSTRAINT uq_rotas_year_rota_type UNIQUE (year, rota_type);
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      ALTER TABLE rota_assignments
      ADD COLUMN IF NOT EXISTS doctor_id VARCHAR(50)
    `);
    await queryRunner.query(`
      UPDATE rota_assignments
      SET doctor_id = ac_doctor_id
      WHERE doctor_id IS NULL AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'rota_assignments'
        AND column_name = 'ac_doctor_id'
      )
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'rota_assignments'
          AND column_name = 'doctor_id'
        ) THEN
          EXECUTE 'ALTER TABLE rota_assignments ALTER COLUMN doctor_id SET NOT NULL';
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_rota_assignments_ac_doctor`);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_rota_assignments_ap_doctor`);
    await queryRunner.query(`ALTER TABLE rota_assignments DROP CONSTRAINT IF EXISTS rota_assignments_rota_id_date_key`);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'rota_assignments'
          AND column_name = 'ac_doctor_id'
        ) THEN
          ALTER TABLE rota_assignments DROP COLUMN ac_doctor_id;
        END IF;
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'rota_assignments'
          AND column_name = 'ap_doctor_id'
        ) THEN
          ALTER TABLE rota_assignments DROP COLUMN ap_doctor_id;
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
      CREATE INDEX IF NOT EXISTS ix_rota_assignments_doctor
      ON rota_assignments (rota_id, doctor_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS ix_rota_assignments_doctor`);
    await queryRunner.query(`ALTER TABLE rota_assignments DROP CONSTRAINT IF EXISTS uq_rota_assignments_rota_date_doctor`);
    await queryRunner.query(`
      ALTER TABLE rota_assignments
      ADD COLUMN IF NOT EXISTS ac_doctor_id VARCHAR(50)
    `);
    await queryRunner.query(`
      ALTER TABLE rota_assignments
      ADD COLUMN IF NOT EXISTS ap_doctor_id VARCHAR(50)
    `);
    await queryRunner.query(`
      UPDATE rota_assignments
      SET ac_doctor_id = doctor_id, ap_doctor_id = doctor_id
      WHERE doctor_id IS NOT NULL
    `);
    await queryRunner.query(`ALTER TABLE rota_assignments ALTER COLUMN ac_doctor_id SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE rota_assignments ALTER COLUMN ap_doctor_id SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE rota_assignments DROP COLUMN IF EXISTS doctor_id`);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'rota_assignments_rota_id_date_key'
        ) THEN
          ALTER TABLE rota_assignments
          ADD CONSTRAINT rota_assignments_rota_id_date_key UNIQUE (rota_id, date);
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_rota_assignments_ac_doctor
      ON rota_assignments (rota_id, ac_doctor_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_rota_assignments_ap_doctor
      ON rota_assignments (rota_id, ap_doctor_id)
    `);

    await queryRunner.query(`ALTER TABLE rotas DROP CONSTRAINT IF EXISTS uq_rotas_year_rota_type`);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'rotas_year_key'
        ) THEN
          ALTER TABLE rotas ADD CONSTRAINT rotas_year_key UNIQUE (year);
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`ALTER TABLE rotas DROP COLUMN IF EXISTS doctors_per_day`);
    await queryRunner.query(`ALTER TABLE rotas DROP COLUMN IF EXISTS rota_type`);
  }
}
