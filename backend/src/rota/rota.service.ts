import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { AppConfigService } from '../config/app-config.service';
import { formatClockTime } from '../common/date.utils';
import { HolidaysService, classifyYear } from '../holidays/holidays.service';
import { InfeasiblePoolError, generateRota } from '../scheduling/assignment.service';
import { DoctorInput } from '../scheduling/scheduling.types';
import { GenerateRotaDto } from './dto/generate-rota.dto';
import { ReplaceDoctorDto } from './dto/replace-doctor.dto';
import { RotaAssignmentEntity } from './entities/rota-assignment.entity';
import { RotaDoctorEntity } from './entities/rota-doctor.entity';
import { RotaEntity } from './entities/rota.entity';
import { RotaResponseMapper } from './rota-response.mapper';

@Injectable()
export class RotaService {
  constructor(
    private readonly appConfigService: AppConfigService,
    private readonly holidaysService: HolidaysService,
    private readonly responseMapper: RotaResponseMapper,
    private readonly dataSource: DataSource,
    @InjectRepository(RotaEntity)
    private readonly rotaRepository: Repository<RotaEntity>,
    @InjectRepository(RotaDoctorEntity)
    private readonly rotaDoctorRepository: Repository<RotaDoctorEntity>,
    @InjectRepository(RotaAssignmentEntity)
    private readonly rotaAssignmentRepository: Repository<RotaAssignmentEntity>,
  ) {}

  async generate(request: GenerateRotaDto) {
    const normalizedPool: DoctorInput[] = request.pool.map((doctor) => ({
      ...doctor,
      hours_reduced_per_day: doctor.hours_reduced_per_day ?? 0,
    }));

    try {
      const holidayItems = await this.holidaysService.getHolidays(
        request.year,
        this.appConfigService.city,
      );
      const holidayDates = new Set(
        holidayItems.map((holiday) => new Date(`${holiday.date}T00:00:00.000Z`)),
      );
      const dayClassifications = classifyYear(request.year, holidayDates);
      const rota = generateRota(
        request.year,
        request.rota_type,
        normalizedPool,
        dayClassifications,
      );

      const persisted = await this.dataSource.transaction(async (manager) => {
        const existing = await manager.findOne(RotaEntity, {
          where: { year: request.year, rotaType: request.rota_type },
        });
        if (existing) {
          await manager.delete(RotaAssignmentEntity, { rotaId: existing.id });
          await manager.delete(RotaDoctorEntity, { rotaId: existing.id });
          await manager.delete(RotaEntity, { id: existing.id });
        }

        const savedRota = await manager.save(
          manager.create(RotaEntity, {
            year: request.year,
            rotaType: request.rota_type,
            city: this.appConfigService.city,
            generatedAt: new Date(),
            pool: normalizedPool,
            doctorsPerDay: rota.doctorsPerDay,
          }),
        );

        await manager.save(
          RotaDoctorEntity,
          normalizedPool.map((doctor) =>
            manager.create(RotaDoctorEntity, {
              rotaId: savedRota.id,
              doctorId: doctor.id,
              name: doctor.name,
              department: doctor.department,
              hoursReducedPerDay: doctor.hours_reduced_per_day ?? 0,
            }),
          ),
        );

        await manager.save(
          RotaAssignmentEntity,
          rota.schedule.flatMap((day) => [
            ...day.doctors.map((doctor) =>
              manager.create(RotaAssignmentEntity, {
                rotaId: savedRota.id,
                date: day.date.toISOString().slice(0, 10),
                dayType: day.dayType,
                shiftStart: formatClockTime(day.shiftStart),
                shiftEnd: formatClockTime(day.shiftEnd),
                durationHours: day.durationHours,
                doctorId: doctor.doctorId,
                assignmentKind: 'primary',
                linkedPrimaryDoctorId: null,
              }),
            ),
            ...day.refuerzos.map((refuerzo) =>
              manager.create(RotaAssignmentEntity, {
                rotaId: savedRota.id,
                date: day.date.toISOString().slice(0, 10),
                dayType: day.dayType,
                shiftStart: formatClockTime(refuerzo.shiftStart),
                shiftEnd: formatClockTime(refuerzo.shiftEnd),
                durationHours: refuerzo.durationHours,
                doctorId: refuerzo.doctorId,
                assignmentKind: 'refuerzo',
                linkedPrimaryDoctorId: refuerzo.linkedPrimaryDoctorId,
              }),
            ),
          ]),
        );

        return manager.findOneOrFail(RotaEntity, {
          where: { id: savedRota.id },
          relations: { assignments: true, doctors: true },
        });
      });

      const response = await this.responseMapper.toResponse(persisted);
      response.warnings = rota.warnings;
      return response;
    } catch (error) {
      if (error instanceof InfeasiblePoolError) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof BadRequestException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new BadGatewayException(`Holiday API error: ${message}`);
    }
  }

  async getByType(year: number, rotaType: string, doctorId?: string) {
    const rota = await this.rotaRepository.findOne({
      where: { year, rotaType },
      relations: { assignments: true, doctors: true },
    });
    if (!rota) {
      throw new NotFoundException(`No ${rotaType} rota found for year ${year}`);
    }

    return this.responseMapper.toResponse(rota, doctorId);
  }

  async getByYear(year: number) {
    const rotas = await this.rotaRepository.find({
      where: { year },
      relations: { assignments: true, doctors: true },
      order: { rotaType: 'ASC' },
    });
    if (rotas.length === 0) {
      throw new NotFoundException(`No rotas found for year ${year}`);
    }

    return Promise.all(rotas.map((rota) => this.responseMapper.toResponse(rota)));
  }

  async replaceDoctor(year: number, rotaType: string, request: ReplaceDoctorDto) {
    const rota = await this.rotaRepository.findOne({
      where: { year, rotaType },
      relations: { assignments: true, doctors: true },
    });
    if (!rota) {
      throw new NotFoundException(`No ${rotaType} rota found for year ${year}`);
    }

    const poolIds = new Set(
      (rota.pool as DoctorInput[]).map((doctor) => doctor.id),
    );
    if (!poolIds.has(request.new_doctor_id)) {
      throw new BadRequestException(
        `Doctor ${request.new_doctor_id} is not in the original pool.`,
      );
    }

    const assignment = await this.rotaAssignmentRepository.findOne({
      where: {
        rotaId: rota.id,
        date: request.date,
        doctorId: request.old_doctor_id,
        assignmentKind: request.assignment_kind ?? 'primary',
      },
    });

    if (!assignment) {
      throw new NotFoundException(
        `Doctor ${request.old_doctor_id} is not assigned as ${
          request.assignment_kind ?? 'primary'
        } on ${request.date}.`,
      );
    }

    assignment.doctorId = request.new_doctor_id;
    await this.rotaAssignmentRepository.save(assignment);

    const refreshed = await this.rotaRepository.findOneOrFail({
      where: { id: rota.id },
      relations: { assignments: true, doctors: true },
    });

    return this.responseMapper.toResponse(refreshed);
  }
}
