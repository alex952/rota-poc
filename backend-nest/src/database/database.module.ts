import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApiConfigModule } from '../config/config.module';
import { AppConfigService } from '../config/app-config.service';
import { createTypeOrmOptions } from './typeorm.config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ApiConfigModule],
      inject: [AppConfigService],
      useFactory: () => createTypeOrmOptions(),
    }),
  ],
})
export class DatabaseModule {}
