import { MigrationInterface, QueryRunner } from 'typeorm';

import { addColumnIfMissing, dropColumnIfExists } from '../migration-helpers';

export class RotaStrategy0061792000000006 implements MigrationInterface {
  name = 'RotaStrategy0061792000000006';

  // Los cuadrantes ya generados se hicieron con el método equilibrado, que es el
  // valor por defecto de la columna.
  public async up(queryRunner: QueryRunner): Promise<void> {
    await addColumnIfMissing(queryRunner, 'rotas', 'strategy', `VARCHAR(20) NOT NULL DEFAULT 'balanced'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await dropColumnIfExists(queryRunner, 'rotas', 'strategy');
  }
}
