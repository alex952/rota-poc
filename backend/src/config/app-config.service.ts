import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  get city(): string {
    return this.configService.get<string>('CITY') ?? 'Madrid';
  }

  get holidayApiUrl(): string {
    return this.configService.get<string>('HOLIDAY_API_URL') ?? 'https://date.nager.at/api/v3';
  }

  get databaseUrl(): string {
    return (
      this.configService.get<string>('DATABASE_URL') ??
      'postgresql://rota_user:rota_pass@localhost:5432/rota'
    );
  }
}
