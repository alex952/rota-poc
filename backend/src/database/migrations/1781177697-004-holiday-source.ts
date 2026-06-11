import { MigrationInterface, QueryRunner } from 'typeorm';

export class HolidaySource0041781177697 implements MigrationInterface {
  name = 'HolidaySource0041781177697';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'holidays'
    `);

    if (tableExists.length === 0) {
      await queryRunner.query(`
        CREATE TABLE holidays (
          id SERIAL PRIMARY KEY,
          year INTEGER NOT NULL,
          city VARCHAR(100) NOT NULL,
          date DATE NOT NULL,
          name VARCHAR(200) NOT NULL,
          source VARCHAR(10) NOT NULL DEFAULT 'api'
        )
      `);
      await queryRunner.query(`
        ALTER TABLE holidays
        ADD CONSTRAINT holidays_year_city_date_key UNIQUE (year, city, date)
      `);
      await queryRunner.query(`
        CREATE INDEX ix_holidays_year_city ON holidays (year, city)
      `);
    } else {
      await queryRunner.query(`
        ALTER TABLE holidays
        ADD COLUMN IF NOT EXISTS source VARCHAR(10) NOT NULL DEFAULT 'api'
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE holidays
      DROP COLUMN IF EXISTS source
    `);
  }
}
