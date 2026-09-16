import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';

import { AppConfigService } from '../config/app-config.service';
import { HolidaysService } from './holidays.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';

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
      throw new BadRequestException(`No se han podido obtener los festivos de ${year}: ${message}`);
    }
  }

  @Post(':year')
  async createHoliday(
    @Param('year', ParseIntPipe) year: number,
    @Body() dto: CreateHolidayDto,
  ) {
    try {
      const holidays = await this.holidaysService.createCustomHoliday(
        year,
        this.appConfigService.city,
        dto.date,
        dto.name,
      );
      return {
        year,
        city: this.appConfigService.city,
        holidays,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('already exists')) {
        throw new ConflictException(message);
      }
      throw new BadRequestException(message);
    }
  }

  @Delete(':year/:date')
  async deleteHoliday(
    @Param('year', ParseIntPipe) year: number,
    @Param('date') date: string,
  ) {
    try {
      const holidays = await this.holidaysService.deleteCustomHoliday(
        year,
        this.appConfigService.city,
        date,
      );
      return {
        year,
        city: this.appConfigService.city,
        holidays,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(message);
    }
  }
}
