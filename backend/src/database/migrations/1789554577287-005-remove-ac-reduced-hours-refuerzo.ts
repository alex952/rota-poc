import { MigrationInterface, QueryRunner } from 'typeorm';

import {
  addColumnIfMissing,
  addUniqueIfMissing,
  columnExists,
  dropColumnIfExists,
  dropIndexIfExists,
} from '../migration-helpers';

export class RemoveAcReducedHoursRefuerzo0051789554577287 implements MigrationInterface {
  name = 'RemoveAcReducedHoursRefuerzo0051789554577287';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Sin la columna assignment_kind estas filas serían indistinguibles de una guardia
    // normal y aparecerían como cobertura AC extra en las rotas ya generadas.
    if (await columnExists(queryRunner, 'rota_assignments', 'assignment_kind')) {
      await queryRunner.query(`
        DELETE FROM rota_assignments
        WHERE assignment_kind = 'refuerzo'
      `);
    }
    // Crear antes de borrar: la FK sobre rota_id necesita un índice que empiece por rota_id.
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

  // Asimetría deliberada: revertir devuelve el esquema, no las filas de refuerzo borradas en up().
  public async down(queryRunner: QueryRunner): Promise<void> {
    await addColumnIfMissing(queryRunner, 'rota_doctors', 'hours_reduced_per_day', 'INT DEFAULT 0');
    await queryRunner.query(`
      UPDATE rota_doctors
      SET hours_reduced_per_day = 0
      WHERE hours_reduced_per_day IS NULL
    `);
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
  }
}
