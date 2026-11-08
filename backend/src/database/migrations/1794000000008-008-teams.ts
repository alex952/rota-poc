import { MigrationInterface, QueryRunner } from 'typeorm';

import {
  addColumnIfMissing,
  addUniqueIfMissing,
  dropColumnIfExists,
  dropIndexIfExists,
  tableExists,
} from '../migration-helpers';

export class Teams0081794000000008 implements MigrationInterface {
  name = 'Teams0081794000000008';

  // Cada equipo tiene su lista de médicos y sus propios cuadrantes. Los cuadrantes
  // existentes pasan al «Equipo principal», que se crea sin médicos: el cliente le
  // carga la lista inicial (assets/doctors.json) la primera vez que lo abre.
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await tableExists(queryRunner, 'teams'))) {
      await queryRunner.query(`
        CREATE TABLE teams (
          id INT NOT NULL AUTO_INCREMENT,
          name VARCHAR(100) NOT NULL,
          doctors JSON NOT NULL,
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          PRIMARY KEY (id),
          CONSTRAINT uq_teams_name UNIQUE (name)
        )
      `);
    }
    await queryRunner.query(`
      INSERT INTO teams (name, doctors)
      SELECT 'Equipo principal', JSON_ARRAY()
      WHERE NOT EXISTS (SELECT 1 FROM teams)
    `);

    await addColumnIfMissing(queryRunner, 'rotas', 'team_id', 'INT NULL');
    await queryRunner.query(`
      UPDATE rotas
      SET team_id = (SELECT id FROM (SELECT MIN(id) AS id FROM teams) AS oldest)
      WHERE team_id IS NULL
    `);
    await queryRunner.query('ALTER TABLE rotas MODIFY COLUMN team_id INT NOT NULL');
    await addUniqueIfMissing(queryRunner, 'rotas', 'uq_rotas_team_year_rota_type', [
      'team_id',
      'year',
      'rota_type',
    ]);
    await dropIndexIfExists(queryRunner, 'rotas', 'uq_rotas_year_rota_type');
  }

  // Sólo se puede deshacer si queda un cuadrante por año y tipo: se conservan los del equipo principal.
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM rota_assignments WHERE rota_id IN (
        SELECT id FROM (SELECT id FROM rotas WHERE team_id <> (SELECT MIN(id) FROM teams)) AS other
      )
    `);
    await queryRunner.query(`
      DELETE FROM rota_doctors WHERE rota_id IN (
        SELECT id FROM (SELECT id FROM rotas WHERE team_id <> (SELECT MIN(id) FROM teams)) AS other
      )
    `);
    await queryRunner.query(`
      DELETE FROM rotas WHERE team_id <> (SELECT id FROM (SELECT MIN(id) AS id FROM teams) AS oldest)
    `);
    await addUniqueIfMissing(queryRunner, 'rotas', 'uq_rotas_year_rota_type', ['year', 'rota_type']);
    await dropIndexIfExists(queryRunner, 'rotas', 'uq_rotas_team_year_rota_type');
    await dropColumnIfExists(queryRunner, 'rotas', 'team_id');
    await queryRunner.query('DROP TABLE IF EXISTS teams');
  }
}
