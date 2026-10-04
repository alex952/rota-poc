import {
  BadGatewayException,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Body,
  StreamableFile,
} from '@nestjs/common';

import { AddDoctorDto } from './dto/add-doctor.dto';
import { GenerateRotaDto } from './dto/generate-rota.dto';
import { ReplaceDoctorDto } from './dto/replace-doctor.dto';
import { RotaExportService } from './rota-export.service';
import { RotaService } from './rota.service';
import { HolidaysService } from '../holidays/holidays.service';
import { AppConfigService } from '../config/app-config.service';

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@Controller('rota')
export class RotaController {
  constructor(
    private readonly rotaService: RotaService,
    private readonly rotaExportService: RotaExportService,
    private readonly holidaysService: HolidaysService,
    private readonly appConfigService: AppConfigService,
  ) {}

  @Post('generate')
  async generate(@Body() request: GenerateRotaDto) {
    return this.rotaService.generate(request);
  }

  @Get(':year/export')
  async exportByYear(@Param('year', ParseIntPipe) year: number) {
    const rotas = await this.rotaService.getByYear(year);
    const buffer = await this.rotaExportService.buildWorkbook(rotas);
    return new StreamableFile(buffer, {
      type: XLSX_CONTENT_TYPE,
      disposition: `attachment; filename="cuadrante-guardias-${year}.xlsx"`,
      length: buffer.length,
    });
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

  @Post(':year/:rotaType/add')
  @HttpCode(200)
  async addDoctor(
    @Param('year', ParseIntPipe) year: number,
    @Param('rotaType') rotaType: string,
    @Body() request: AddDoctorDto,
  ) {
    return this.rotaService.addDoctor(year, rotaType, request);
  }

  private async ensureHolidaysLoaded(year: number): Promise<void> {
    try {
      await this.holidaysService.getHolidays(
        year,
        this.appConfigService.city,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new BadGatewayException(`No se han podido obtener los festivos de ${year}: ${message}`);
    }
  }
}
