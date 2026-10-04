import { TypeOrmModuleOptions } from '@nestjs/typeorm';

import { HolidayEntity } from '../rota/entities/holiday.entity';
import { RotaAssignmentEntity } from '../rota/entities/rota-assignment.entity';
import { RotaDoctorEntity } from '../rota/entities/rota-doctor.entity';
import { RotaEntity } from '../rota/entities/rota.entity';
import { InitialSchema0011763395001001 } from './migrations/1763395001001-001-initial-schema';
import { SeparateAcApPools0021763395002002 } from './migrations/1763395002002-002-separate-ac-ap-pools';
import { AcReducedHoursRefuerzo0031763395003003 } from './migrations/1763395003003-003-ac-reduced-hours-refuerzo';
import { HolidaySource0041781177697 } from './migrations/1781177697-004-holiday-source';
import { RemoveAcReducedHoursRefuerzo0051789554577287 } from './migrations/1789554577287-005-remove-ac-reduced-hours-refuerzo';

const entities = [HolidayEntity, RotaEntity, RotaDoctorEntity, RotaAssignmentEntity];
const migrations = [
  InitialSchema0011763395001001,
  SeparateAcApPools0021763395002002,
  AcReducedHoursRefuerzo0031763395003003,
  HolidaySource0041781177697,
  RemoveAcReducedHoursRefuerzo0051789554577287,
];

export function createTypeOrmOptions(): TypeOrmModuleOptions {
  const dbType = process.env.DB_TYPE ?? 'mysql';

  if (dbType === 'sqljs') {
    return {
      type: 'sqljs',
      autoSave: false,
      synchronize: true,
      dropSchema: true,
      entities,
      migrations,
    };
  }

  return {
    type: 'mysql',
    url: process.env.DATABASE_URL ?? 'mysql://rota_user:rota_pass@localhost:3306/rota',
    timezone: 'Z',
    dateStrings: ['DATE'],
    synchronize: false,
    entities,
    migrations,
    migrationsTableName: 'migrations',
  };
}
