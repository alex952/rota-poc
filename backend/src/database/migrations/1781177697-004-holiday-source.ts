import { MigrationInterface, QueryRunner } from 'typeorm';

export class HolidaySource0041781177697 implements MigrationInterface {
  name = 'HolidaySource0041781177697';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE holidays
      ADD COLUMN IF NOT EXISTS source VARCHAR(10) NOT NULL DEFAULT 'api'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE holidays
      DROP COLUMN IF EXISTS source
    `);
  }
}
