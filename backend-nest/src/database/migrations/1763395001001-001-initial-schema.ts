import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema0011763395001001 implements MigrationInterface {
  name = 'InitialSchema0011763395001001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rotas (
        id SERIAL PRIMARY KEY,
        year INTEGER NOT NULL,
        city VARCHAR(100) NOT NULL,
        generated_at TIMESTAMPTZ NOT NULL,
        pool JSONB NOT NULL
      )
    `);
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

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rota_doctors (
        id SERIAL PRIMARY KEY,
        rota_id INTEGER NOT NULL REFERENCES rotas(id) ON DELETE CASCADE,
        doctor_id VARCHAR(50) NOT NULL,
        name VARCHAR(200) NOT NULL,
        department VARCHAR(200) NOT NULL
      )
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'rota_doctors_rota_id_doctor_id_key'
        ) THEN
          ALTER TABLE rota_doctors
          ADD CONSTRAINT rota_doctors_rota_id_doctor_id_key UNIQUE (rota_id, doctor_id);
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rota_assignments (
        id SERIAL PRIMARY KEY,
        rota_id INTEGER NOT NULL REFERENCES rotas(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        day_type VARCHAR(20) NOT NULL,
        shift_start TIME NOT NULL,
        shift_end TIME NOT NULL,
        duration_hours INTEGER NOT NULL,
        ac_doctor_id VARCHAR(50) NOT NULL,
        ap_doctor_id VARCHAR(50) NOT NULL
      )
    `);
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

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS holidays (
        id SERIAL PRIMARY KEY,
        year INTEGER NOT NULL,
        city VARCHAR(100) NOT NULL,
        date DATE NOT NULL,
        name VARCHAR(200) NOT NULL
      )
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'holidays_year_city_date_key'
        ) THEN
          ALTER TABLE holidays
          ADD CONSTRAINT holidays_year_city_date_key UNIQUE (year, city, date);
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_holidays_year_city
      ON holidays (year, city)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS ix_holidays_year_city`);
    await queryRunner.query(`DROP TABLE IF EXISTS holidays`);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_rota_assignments_ap_doctor`);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_rota_assignments_ac_doctor`);
    await queryRunner.query(`DROP TABLE IF EXISTS rota_assignments`);
    await queryRunner.query(`DROP TABLE IF EXISTS rota_doctors`);
    await queryRunner.query(`DROP TABLE IF EXISTS rotas`);
  }
}
