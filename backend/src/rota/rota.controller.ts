import {
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

@Controller('rota')
export class RotaController {
  constructor(private readonly rotaService: RotaService) {}

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
    return this.rotaService.getByType(year, rotaType, doctorId);
  }

  @Get(':year')
  async getByYear(@Param('year', ParseIntPipe) year: number) {
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
}
