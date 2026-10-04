import { MigrationInterface, QueryRunner } from 'typeorm';

import {
  addColumnIfMissing,
  addUniqueIfMissing,
  createIndexIfMissing,
  dropColumnIfExists,
  tableExists,
} from '../migration-helpers';

export class HolidaySource0041781177697 implements MigrationInterface {
  name = 'HolidaySource0041781177697';

  // OJO: el timestamp de esta migración está en segundos, no en milisegundos, así que
  // TypeORM la ordena antes que la 001. En una base vacía se ejecuta la primera y es ella
  // quien crea `holidays`. No renombrar ni "corregir" el timestamp.
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await tableExists(queryRunner, 'holidays'))) {
      await queryRunner.query(`
        CREATE TABLE holidays (
          id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          year INT NOT NULL,
          city VARCHAR(100) NOT NULL,
          date DATE NOT NULL,
          name VARCHAR(200) NOT NULL,
          source VARCHAR(10) NOT NULL DEFAULT 'api'
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs
      `);
      await addUniqueIfMissing(queryRunner, 'holidays', 'holidays_year_city_date_key', [
        'year',
        'city',
        'date',
      ]);
      await createIndexIfMissing(queryRunner, 'holidays', 'ix_holidays_year_city', ['year', 'city']);
    } else {
      await addColumnIfMissing(
        queryRunner,
        'holidays',
        'source',
        `VARCHAR(10) NOT NULL DEFAULT 'api'`,
      );
    }
  }

  // Al revertir, la 001 ya ha borrado `holidays` (la 004 es la última en revertirse
  // por su timestamp), así que la tabla puede no existir.
  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await tableExists(queryRunner, 'holidays')) {
      await dropColumnIfExists(queryRunner, 'holidays', 'source');
    }
  }
}
