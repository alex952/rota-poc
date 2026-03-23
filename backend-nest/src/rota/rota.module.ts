import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApiConfigModule } from '../config/config.module';
import { HolidaysModule } from '../holidays/holidays.module';
import { RotaAssignmentEntity } from './entities/rota-assignment.entity';
import { RotaDoctorEntity } from './entities/rota-doctor.entity';
import { RotaEntity } from './entities/rota.entity';
import { RotaController } from './rota.controller';
import { RotaResponseMapper } from './rota-response.mapper';
import { RotaService } from './rota.service';

@Module({
  imports: [
    ApiConfigModule,
    HolidaysModule,
    TypeOrmModule.forFeature([RotaEntity, RotaDoctorEntity, RotaAssignmentEntity]),
  ],
  controllers: [RotaController],
  providers: [RotaService, RotaResponseMapper],
})
export class RotaModule {}
