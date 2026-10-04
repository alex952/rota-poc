import { MigrationInterface, QueryRunner } from 'typeorm';

import { addUniqueIfMissing, createIndexIfMissing } from '../migration-helpers';

const TABLE_OPTIONS = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs';

export class InitialSchema0011763395001001 implements MigrationInterface {
  name = 'InitialSchema0011763395001001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rotas (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        year INT NOT NULL,
        city VARCHAR(100) NOT NULL,
        generated_at DATETIME(3) NOT NULL,
        pool JSON NOT NULL
      ) ${TABLE_OPTIONS}
    `);
    await addUniqueIfMissing(queryRunner, 'rotas', 'rotas_year_key', ['year']);

    // La FK va a nivel de tabla: MySQL ignora en silencio `REFERENCES` en línea.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rota_doctors (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        rota_id INT NOT NULL,
        doctor_id VARCHAR(50) NOT NULL,
        name VARCHAR(200) NOT NULL,
        department VARCHAR(200) NOT NULL,
        CONSTRAINT fk_rota_doctors_rota FOREIGN KEY (rota_id) REFERENCES rotas (id) ON DELETE CASCADE
      ) ${TABLE_OPTIONS}
    `);
    await addUniqueIfMissing(queryRunner, 'rota_doctors', 'rota_doctors_rota_id_doctor_id_key', [
      'rota_id',
      'doctor_id',
    ]);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rota_assignments (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        rota_id INT NOT NULL,
        date DATE NOT NULL,
        day_type VARCHAR(20) NOT NULL,
        shift_start TIME NOT NULL,
        shift_end TIME NOT NULL,
        duration_hours INT NOT NULL,
        ac_doctor_id VARCHAR(50) NOT NULL,
        ap_doctor_id VARCHAR(50) NOT NULL,
        CONSTRAINT fk_rota_assignments_rota FOREIGN KEY (rota_id) REFERENCES rotas (id) ON DELETE CASCADE
      ) ${TABLE_OPTIONS}
    `);
    await addUniqueIfMissing(queryRunner, 'rota_assignments', 'rota_assignments_rota_id_date_key', [
      'rota_id',
      'date',
    ]);
    await createIndexIfMissing(queryRunner, 'rota_assignments', 'ix_rota_assignments_ac_doctor', [
      'rota_id',
      'ac_doctor_id',
    ]);
    await createIndexIfMissing(queryRunner, 'rota_assignments', 'ix_rota_assignments_ap_doctor', [
      'rota_id',
      'ap_doctor_id',
    ]);

    // La migración 004 (timestamp en segundos) se ejecuta antes que esta y ya crea
    // `holidays` en una base vacía; por eso aquí es IF NOT EXISTS.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS holidays (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        year INT NOT NULL,
        city VARCHAR(100) NOT NULL,
        date DATE NOT NULL,
        name VARCHAR(200) NOT NULL
      ) ${TABLE_OPTIONS}
    `);
    await addUniqueIfMissing(queryRunner, 'holidays', 'holidays_year_city_date_key', [
      'year',
      'city',
      'date',
    ]);
    await createIndexIfMissing(queryRunner, 'holidays', 'ix_holidays_year_city', ['year', 'city']);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS holidays`);
    await queryRunner.query(`DROP TABLE IF EXISTS rota_assignments`);
    await queryRunner.query(`DROP TABLE IF EXISTS rota_doctors`);
    await queryRunner.query(`DROP TABLE IF EXISTS rotas`);
  }
}
