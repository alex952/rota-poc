import { MigrationInterface, QueryRunner } from 'typeorm';

import {
  addColumnIfMissing,
  addUniqueIfMissing,
  dropColumnIfExists,
  dropIndexIfExists,
} from '../migration-helpers';

export class AcReducedHoursRefuerzo0031763395003003 implements MigrationInterface {
  name = 'AcReducedHoursRefuerzo0031763395003003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await addColumnIfMissing(queryRunner, 'rota_doctors', 'hours_reduced_per_day', 'INT DEFAULT 0');
    await queryRunner.query(`
      UPDATE rota_doctors
      SET hours_reduced_per_day = 0
      WHERE hours_reduced_per_day IS NULL
    `);
    // Al omitir DEFAULT, MODIFY elimina el valor por defecto.
    await queryRunner.query(`
      ALTER TABLE rota_doctors
      MODIFY COLUMN hours_reduced_per_day INT NOT NULL
    `);

    await addColumnIfMissing(
      queryRunner,
      'rota_assignments',
      'assignment_kind',
      `VARCHAR(20) DEFAULT 'primary'`,
    );
    await addColumnIfMissing(
      queryRunner,
      'rota_assignments',
      'linked_primary_doctor_id',
      'VARCHAR(50)',
    );
    await queryRunner.query(`
      UPDATE rota_assignments
      SET assignment_kind = 'primary'
      WHERE assignment_kind IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE rota_assignments
      MODIFY COLUMN assignment_kind VARCHAR(20) NOT NULL
    `);

    // Crear antes de borrar: la FK sobre rota_id necesita un índice que empiece por rota_id.
    await addUniqueIfMissing(
      queryRunner,
      'rota_assignments',
      'uq_rota_assignments_rota_date_doctor_kind',
      ['rota_id', 'date', 'doctor_id', 'assignment_kind'],
    );
    await dropIndexIfExists(queryRunner, 'rota_assignments', 'uq_rota_assignments_rota_date_doctor');
    await dropIndexIfExists(
      queryRunner,
      'rota_assignments',
      'rota_assignments_rota_id_date_doctor_id_key',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await addUniqueIfMissing(queryRunner, 'rota_assignments', 'uq_rota_assignments_rota_date_doctor', [
      'rota_id',
      'date',
      'doctor_id',
    ]);
    await dropIndexIfExists(
      queryRunner,
      'rota_assignments',
      'uq_rota_assignments_rota_date_doctor_kind',
    );
    await dropColumnIfExists(queryRunner, 'rota_assignments', 'linked_primary_doctor_id');
    await dropColumnIfExists(queryRunner, 'rota_assignments', 'assignment_kind');
    await dropColumnIfExists(queryRunner, 'rota_doctors', 'hours_reduced_per_day');
  }
}
