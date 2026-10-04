import { MigrationInterface, QueryRunner } from 'typeorm';

import {
  addColumnIfMissing,
  addUniqueIfMissing,
  columnExists,
  createIndexIfMissing,
  dropColumnIfExists,
  dropIndexIfExists,
} from '../migration-helpers';

// Regla de InnoDB: la FK rota_assignments.rota_id necesita siempre un índice que empiece
// por rota_id. Por eso cada índice nuevo se crea ANTES de borrar el viejo y los índices
// se borran explícitamente antes de borrar sus columnas (si no, MySQL encoge el índice
// multicolumna en silencio, o falla con el error 1553).
export class SeparateAcApPools0021763395002002 implements MigrationInterface {
  name = 'SeparateAcApPools0021763395002002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await addColumnIfMissing(queryRunner, 'rotas', 'rota_type', 'VARCHAR(2)');
    await addColumnIfMissing(queryRunner, 'rotas', 'doctors_per_day', 'INT');
    await queryRunner.query(`
      UPDATE rotas
      SET rota_type = 'AC', doctors_per_day = 1
      WHERE rota_type IS NULL OR doctors_per_day IS NULL
    `);
    await queryRunner.query(`ALTER TABLE rotas MODIFY COLUMN rota_type VARCHAR(2) NOT NULL`);
    await queryRunner.query(`ALTER TABLE rotas MODIFY COLUMN doctors_per_day INT NOT NULL`);
    await addUniqueIfMissing(queryRunner, 'rotas', 'uq_rotas_year_rota_type', ['year', 'rota_type']);
    await dropIndexIfExists(queryRunner, 'rotas', 'rotas_year_key');

    await addColumnIfMissing(queryRunner, 'rota_assignments', 'doctor_id', 'VARCHAR(50)');
    if (await columnExists(queryRunner, 'rota_assignments', 'ac_doctor_id')) {
      await queryRunner.query(`
        UPDATE rota_assignments
        SET doctor_id = ac_doctor_id
        WHERE doctor_id IS NULL
      `);
    }
    await queryRunner.query(
      `ALTER TABLE rota_assignments MODIFY COLUMN doctor_id VARCHAR(50) NOT NULL`,
    );
    // Primero lo nuevo...
    await addUniqueIfMissing(queryRunner, 'rota_assignments', 'uq_rota_assignments_rota_date_doctor', [
      'rota_id',
      'date',
      'doctor_id',
    ]);
    await createIndexIfMissing(queryRunner, 'rota_assignments', 'ix_rota_assignments_doctor', [
      'rota_id',
      'doctor_id',
    ]);
    // ...y sólo entonces lo viejo.
    await dropIndexIfExists(queryRunner, 'rota_assignments', 'ix_rota_assignments_ac_doctor');
    await dropIndexIfExists(queryRunner, 'rota_assignments', 'ix_rota_assignments_ap_doctor');
    await dropIndexIfExists(queryRunner, 'rota_assignments', 'rota_assignments_rota_id_date_key');
    await dropColumnIfExists(queryRunner, 'rota_assignments', 'ac_doctor_id');
    await dropColumnIfExists(queryRunner, 'rota_assignments', 'ap_doctor_id');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await addColumnIfMissing(queryRunner, 'rota_assignments', 'ac_doctor_id', 'VARCHAR(50)');
    await addColumnIfMissing(queryRunner, 'rota_assignments', 'ap_doctor_id', 'VARCHAR(50)');
    await queryRunner.query(`
      UPDATE rota_assignments
      SET ac_doctor_id = doctor_id, ap_doctor_id = doctor_id
      WHERE doctor_id IS NOT NULL
    `);
    await queryRunner.query(
      `ALTER TABLE rota_assignments MODIFY COLUMN ac_doctor_id VARCHAR(50) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE rota_assignments MODIFY COLUMN ap_doctor_id VARCHAR(50) NOT NULL`,
    );
    // Primero lo que se restaura...
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
    // ...y después se retira lo nuevo, índices antes que la columna.
    await dropIndexIfExists(queryRunner, 'rota_assignments', 'ix_rota_assignments_doctor');
    await dropIndexIfExists(queryRunner, 'rota_assignments', 'uq_rota_assignments_rota_date_doctor');
    await dropColumnIfExists(queryRunner, 'rota_assignments', 'doctor_id');

    await addUniqueIfMissing(queryRunner, 'rotas', 'rotas_year_key', ['year']);
    await dropIndexIfExists(queryRunner, 'rotas', 'uq_rotas_year_rota_type');
    await dropColumnIfExists(queryRunner, 'rotas', 'doctors_per_day');
    await dropColumnIfExists(queryRunner, 'rotas', 'rota_type');
  }
}
