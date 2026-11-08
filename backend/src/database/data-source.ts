import 'reflect-metadata';

import { existsSync } from 'fs';

import { DataSource, DataSourceOptions } from 'typeorm';

import { createTypeOrmOptions } from './typeorm.config';

// El CLI de TypeORM (migration:run, migration:show…) no pasa por ConfigModule: carga aquí
// backend/.env, igual que la aplicación. Las variables ya definidas en el entorno mandan.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default new DataSource(createTypeOrmOptions() as DataSourceOptions);
