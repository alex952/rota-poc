import {
  BadGatewayException,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Body,
} from '@nestjs/common';

import { GenerateRotaDto } from './dto/generate-rota.dto';
import { ReplaceDoctorDto } from './dto/replace-doctor.dto';
import { RotaService } from './rota.service';
import { HolidaysService } from '../holidays/holidays.service';
import { AppConfigService } from '../config/app-config.service';

@Controller('rota')
export class RotaController {
  constructor(
    private readonly rotaService: RotaService,
    private readonly holidaysService: HolidaysService,
    private readonly appConfigService: AppConfigService,
  ) {}

  @Post('generate')
  async generate(@Body() request: GenerateRotaDto) {
    return this.rotaService.generate(request);
  }

  @Get(':year/:rotaType')
  async getByType(
    @Param('year', ParseIntPipe) year: number,
    @Param('rotaType') rotaType: string,
    @Query('doctor_id') doctorId?: string,
  ) {
    await this.ensureHolidaysLoaded(year);
    return this.rotaService.getByType(year, rotaType, doctorId);
  }

  @Get(':year')
  async getByYear(@Param('year', ParseIntPipe) year: number) {
    await this.ensureHolidaysLoaded(year);
    return this.rotaService.getByYear(year);
  }

  @Patch(':year/:rotaType/replace')
  async replaceDoctor(
    @Param('year', ParseIntPipe) year: number,
    @Param('rotaType') rotaType: string,
    @Body() request: ReplaceDoctorDto,
  ) {
    return this.rotaService.replaceDoctor(year, rotaType, request);
  }

  private async ensureHolidaysLoaded(year: number): Promise<void> {
    try {
      await this.holidaysService.getHolidays(
        year,
        this.appConfigService.city,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new BadGatewayException(`Could not resolve holidays for ${year}: ${message}`);
    }
  }
}
