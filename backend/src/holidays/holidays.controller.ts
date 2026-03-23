import { BadGatewayException, Controller, Get, Param, ParseIntPipe } from '@nestjs/common';

import { AppConfigService } from '../config/app-config.service';
import { HolidaysService } from './holidays.service';

@Controller('holidays')
export class HolidaysController {
  constructor(
    private readonly holidaysService: HolidaysService,
    private readonly appConfigService: AppConfigService,
  ) {}

  @Get(':year')
  async getHolidays(@Param('year', ParseIntPipe) year: number) {
    try {
      const holidays = await this.holidaysService.getHolidays(year, this.appConfigService.city);
      return {
        year,
        city: this.appConfigService.city,
        holidays,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new BadGatewayException(`Holiday API error: ${message}`);
    }
  }
}
