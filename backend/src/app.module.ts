import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ApiConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { HolidaysModule } from './holidays/holidays.module';
import { RotaModule } from './rota/rota.module';
import { TeamsModule } from './teams/teams.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ApiConfigModule,
    DatabaseModule,
    HolidaysModule,
    RotaModule,
    TeamsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
