import { QueryRunner } from 'typeorm';

/**
 * Helpers de migración para MySQL.
 *
 * MySQL 8 no admite `ADD COLUMN IF NOT EXISTS`, `DROP COLUMN IF EXISTS`,
 * `DROP CONSTRAINT IF EXISTS` ni `CREATE INDEX IF NOT EXISTS`, y tampoco tiene
 * bloques anónimos (`DO $$ ... $$`). Además cada DDL hace commit implícito: una
 * migración que falla a mitad deja el esquema a medias. Por eso las migraciones son
 * idempotentes y la comprobación previa se hace aquí, consultando `information_schema`
 * del esquema actual (`DATABASE()`).
 *
 * No se usa `queryRunner.hasColumn()` de TypeORM porque cachea la tabla y las
 * sentencias DDL lanzadas con `query()` no invalidan esa caché.
 */

export async function tableExists(queryRunner: QueryRunner, table: string): Promise<boolean> {
  const rows = await queryRunner.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`,
    [table],
  );
  return rows.length > 0;
}

export async function columnExists(
  queryRunner: QueryRunner,
  table: string,
  column: string,
): Promise<boolean> {
  const rows = await queryRunner.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, column],
  );
  return rows.length > 0;
}

/** En MySQL una restricción UNIQUE es un índice, así que sirve para ambas cosas. */
export async function indexExists(
  queryRunner: QueryRunner,
  table: string,
  name: string,
): Promise<boolean> {
  const rows = await queryRunner.query(
    `SELECT 1 FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
    [table, name],
  );
  return rows.length > 0;
}

export async function addColumnIfMissing(
  queryRunner: QueryRunner,
  table: string,
  column: string,
  definition: string,
): Promise<void> {
  if (!(await columnExists(queryRunner, table, column))) {
    await queryRunner.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  }
}

export async function dropColumnIfExists(
  queryRunner: QueryRunner,
  table: string,
  column: string,
): Promise<void> {
  if (await columnExists(queryRunner, table, column)) {
    await queryRunner.query(`ALTER TABLE \`${table}\` DROP COLUMN \`${column}\``);
  }
}

export async function addUniqueIfMissing(
  queryRunner: QueryRunner,
  table: string,
  name: string,
  columns: string[],
): Promise<void> {
  if (!(await indexExists(queryRunner, table, name))) {
    const cols = columns.map((column) => `\`${column}\``).join(', ');
    await queryRunner.query(`ALTER TABLE \`${table}\` ADD CONSTRAINT \`${name}\` UNIQUE (${cols})`);
  }
}

export async function createIndexIfMissing(
  queryRunner: QueryRunner,
  table: string,
  name: string,
  columns: string[],
): Promise<void> {
  if (!(await indexExists(queryRunner, table, name))) {
    const cols = columns.map((column) => `\`${column}\``).join(', ');
    await queryRunner.query(`CREATE INDEX \`${name}\` ON \`${table}\` (${cols})`);
  }
}

export async function dropIndexIfExists(
  queryRunner: QueryRunner,
  table: string,
  name: string,
): Promise<void> {
  if (await indexExists(queryRunner, table, name)) {
    await queryRunner.query(`ALTER TABLE \`${table}\` DROP INDEX \`${name}\``);
  }
}
