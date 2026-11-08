import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  // Ciudad del hospital: decide los festivos regionales (Alicante → Comunitat Valenciana, ES-VC).
  get city(): string {
    return this.configService.get<string>('CITY') ?? 'Alicante';
  }

  get holidayApiUrl(): string {
    return this.configService.get<string>('HOLIDAY_API_URL') ?? 'https://date.nager.at/api/v3';
  }

  get databaseUrl(): string {
    return (
      this.configService.get<string>('DATABASE_URL') ??
      'mysql://rota_user:rota_pass@localhost:3306/rota'
    );
  }
}
