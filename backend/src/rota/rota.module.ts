import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApiConfigModule } from '../config/config.module';
import { HolidaysModule } from '../holidays/holidays.module';
import { TeamsModule } from '../teams/teams.module';
import { RotaAssignmentEntity } from './entities/rota-assignment.entity';
import { RotaDoctorEntity } from './entities/rota-doctor.entity';
import { RotaEntity } from './entities/rota.entity';
import { RotaController } from './rota.controller';
import { RotaExportService } from './rota-export.service';
import { RotaResponseMapper } from './rota-response.mapper';
import { RotaService } from './rota.service';

@Module({
  imports: [
    ApiConfigModule,
    HolidaysModule,
    TeamsModule,
    TypeOrmModule.forFeature([RotaEntity, RotaDoctorEntity, RotaAssignmentEntity]),
  ],
  controllers: [RotaController],
  providers: [RotaService, RotaExportService, RotaResponseMapper],
})
export class RotaModule {}
