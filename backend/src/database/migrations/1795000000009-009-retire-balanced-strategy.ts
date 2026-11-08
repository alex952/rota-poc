import { MigrationInterface, QueryRunner } from 'typeorm';

export class RetireBalancedStrategy0091795000000009 implements MigrationInterface {
  name = 'RetireBalancedStrategy0091795000000009';

  // Se retira el método equilibrado ('balanced'): el nuevo valor por defecto es 'single-wheel'.
  // Los cuadrantes ya guardados con 'balanced' se conservan tal cual, porque se
  // generaron con ese método; la interfaz los muestra como «Equilibrado (retirado)».
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE rotas ALTER COLUMN strategy SET DEFAULT 'single-wheel'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE rotas ALTER COLUMN strategy SET DEFAULT 'balanced'`);
  }
}
