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
        request.pool,
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
            pool: request.pool,
            doctorsPerDay: rota.doctorsPerDay,
          }),
        );

        await manager.save(
          RotaDoctorEntity,
          request.pool.map((doctor) =>
            manager.create(RotaDoctorEntity, {
              rotaId: savedRota.id,
              doctorId: doctor.id,
              name: doctor.name,
              department: doctor.department,
            }),
          ),
        );

        await manager.save(
          RotaAssignmentEntity,
          rota.schedule.flatMap((day) =>
            day.doctors.map((doctor) =>
              manager.create(RotaAssignmentEntity, {
                rotaId: savedRota.id,
                date: day.date.toISOString().slice(0, 10),
                dayType: day.dayType,
                shiftStart: formatClockTime(day.shiftStart),
                shiftEnd: formatClockTime(day.shiftEnd),
                durationHours: day.durationHours,
                doctorId: doctor.doctorId,
              }),
            ),
          ),
        );

        return manager.findOneOrFail(RotaEntity, {
          where: { id: savedRota.id },
          relations: { assignments: true, doctors: true },
        });
      });

      return this.responseMapper.toResponse(persisted);
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
    return this.dataSource.transaction(async (manager) => {
      const rotaRepository = manager.getRepository(RotaEntity);
      const assignmentRepository = manager.getRepository(RotaAssignmentEntity);

      const rota = await rotaRepository.findOne({
        where: { year, rotaType },
        relations: { assignments: true, doctors: true },
      });
      if (!rota) {
        throw new NotFoundException(`No ${rotaType} rota found for year ${year}`);
      }

      const poolDoctorIds = new Set((rota.pool as DoctorInput[]).map((doctor) => doctor.id));
      if (!poolDoctorIds.has(request.new_doctor_id)) {
        throw new BadRequestException(
          `Doctor ${request.new_doctor_id} is not in the original pool.`,
        );
      }

      const assignment = await assignmentRepository.findOne({
        where: {
          rotaId: rota.id,
          date: request.date,
          doctorId: request.old_doctor_id,
        },
      });
      if (!assignment) {
        throw new NotFoundException(
          `Doctor ${request.old_doctor_id} is not assigned on ${request.date}.`,
        );
      }

      const hasConflict = rota.assignments.some(
        (candidate) =>
          candidate.date === request.date &&
          candidate.doctorId === request.new_doctor_id &&
          candidate.id !== assignment.id,
      );
      if (hasConflict) {
        throw new BadRequestException(
          `Doctor ${request.new_doctor_id} already has an assignment on ${request.date}.`,
        );
      }

      assignment.doctorId = request.new_doctor_id;
      await assignmentRepository.save(assignment);

      const refreshed = await rotaRepository.findOneOrFail({
        where: { id: rota.id },
        relations: { assignments: true, doctors: true },
      });

      return this.responseMapper.toResponse(refreshed);
    });
  }
}
