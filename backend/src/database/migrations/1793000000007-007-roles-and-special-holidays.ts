import { MigrationInterface, QueryRunner } from 'typeorm';

import { addColumnIfMissing, dropColumnIfExists } from '../migration-helpers';

export class RolesAndSpecialHolidays0071793000000007 implements MigrationInterface {
  name = 'RolesAndSpecialHolidays0071793000000007';

  // Hasta ahora cada día tenía una guardia AC y uno o dos refuerzos AP: las filas AP
  // existentes son refuerzos. Los festivos especiales de las cachés existentes se
  // añaden y marcan al leerlos (HolidaysService.getHolidays).
  public async up(queryRunner: QueryRunner): Promise<void> {
    await addColumnIfMissing(queryRunner, 'rota_assignments', 'role', `VARCHAR(20) NOT NULL DEFAULT 'guardia'`);
    await queryRunner.query(`
      UPDATE rota_assignments
      SET role = 'refuerzo'
      WHERE rota_id IN (SELECT id FROM rotas WHERE rota_type = 'AP')
    `);
    await addColumnIfMissing(queryRunner, 'holidays', 'is_special', 'BOOLEAN NOT NULL DEFAULT FALSE');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await dropColumnIfExists(queryRunner, 'holidays', 'is_special');
    await dropColumnIfExists(queryRunner, 'rota_assignments', 'role');
  }
}
