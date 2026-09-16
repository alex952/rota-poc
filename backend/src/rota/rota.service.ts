import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { AppConfigService } from '../config/app-config.service';
import { addDays, formatClockTime } from '../common/date.utils';
import { HolidaysService, classifyYear } from '../holidays/holidays.service';
import {
  InfeasiblePoolError,
  generateRota,
  refuerzoDetails,
} from '../scheduling/assignment.service';
import { DayType, DoctorInput } from '../scheduling/scheduling.types';
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
      throw new BadGatewayException(`Could not resolve holidays for ${request.year}: ${message}`);
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

      const assignmentKind = request.assignment_kind ?? 'primary';
      const doctorMap = this.buildDoctorMap(rota);
      if (!doctorMap.has(request.new_doctor_id)) {
        throw new BadRequestException(
          `Doctor ${request.new_doctor_id} is not in the original pool.`,
        );
      }

      if (
        assignmentKind === 'refuerzo' &&
        this.hasReducedHours(doctorMap, request.new_doctor_id)
      ) {
        throw new BadRequestException(
          'Reduced-hours doctors cannot cover refuerzo assignments.',
        );
      }

      const assignment = await assignmentRepository.findOne({
        where: {
          rotaId: rota.id,
          date: request.date,
          doctorId: request.old_doctor_id,
          assignmentKind,
        },
      });

      if (!assignment && assignmentKind === 'refuerzo') {
        if (
          await this.hasSameDayConflict(
            manager,
            rota.id,
            request.date,
            request.new_doctor_id,
          )
        ) {
          throw new BadRequestException(
            `Doctor ${request.new_doctor_id} already has an assignment on ${request.date}.`,
          );
        }

        await this.createMissingRefuerzo(manager, rota, request, doctorMap);
        const refreshed = await rotaRepository.findOneOrFail({
          where: { id: rota.id },
          relations: { assignments: true, doctors: true },
        });
        return this.responseMapper.toResponse(refreshed);
      }

      if (!assignment) {
        throw new NotFoundException(
          `Doctor ${request.old_doctor_id} is not assigned as ${assignmentKind} on ${request.date}.`,
        );
      }

      const promotableRefuerzo =
        assignmentKind === 'primary'
          ? await this.getPromotableRefuerzoAssignment(
              manager,
              rota.id,
              request.date,
              assignment.doctorId,
              request.new_doctor_id,
              doctorMap,
            )
          : null;

      if (
        await this.hasSameDayConflict(
          manager,
          rota.id,
          request.date,
          request.new_doctor_id,
          [assignment.id, ...(promotableRefuerzo ? [promotableRefuerzo.id] : [])],
        )
      ) {
        throw new BadRequestException(
          `Doctor ${request.new_doctor_id} already has an assignment on ${request.date}.`,
        );
      }

      const oldDoctorId = assignment.doctorId;
      assignment.doctorId = request.new_doctor_id;
      await assignmentRepository.save(assignment);

      const warnings =
        assignmentKind === 'primary'
          ? await this.syncPrimaryRefuerzoState(
              manager,
              rota,
              assignment,
              oldDoctorId,
              request.new_doctor_id,
              doctorMap,
            )
          : [];

      const refreshed = await rotaRepository.findOneOrFail({
        where: { id: rota.id },
        relations: { assignments: true, doctors: true },
      });

      const response = await this.responseMapper.toResponse(refreshed);
      response.warnings = warnings;
      return response;
    });
  }

  private buildDoctorMap(rota: RotaEntity): Map<string, DoctorInput> {
    return new Map(
      (rota.pool as DoctorInput[]).map((doctor) => [
        doctor.id,
        {
          ...doctor,
          hours_reduced_per_day: doctor.hours_reduced_per_day ?? 0,
        },
      ]),
    );
  }

  private hasReducedHours(
    doctorMap: Map<string, DoctorInput>,
    doctorId: string | null | undefined,
  ): boolean {
    if (!doctorId) {
      return false;
    }

    return (doctorMap.get(doctorId)?.hours_reduced_per_day ?? 0) > 0;
  }

  private async hasSameDayConflict(
    manager: EntityManager,
    rotaId: number,
    date: string,
    doctorId: string,
    excludeAssignmentIds: number[] = [],
  ): Promise<boolean> {
    const query = manager
      .getRepository(RotaAssignmentEntity)
      .createQueryBuilder('assignment')
      .where('assignment.rotaId = :rotaId', { rotaId })
      .andWhere('assignment.date = :date', { date })
      .andWhere('assignment.doctorId = :doctorId', { doctorId });

    if (excludeAssignmentIds.length > 0) {
      query.andWhere('assignment.id NOT IN (:...excludeAssignmentIds)', {
        excludeAssignmentIds,
      });
    }

    return (await query.getCount()) > 0;
  }

  private async getPromotableRefuerzoAssignment(
    manager: EntityManager,
    rotaId: number,
    date: string,
    oldDoctorId: string,
    newDoctorId: string,
    doctorMap: Map<string, DoctorInput>,
  ): Promise<RotaAssignmentEntity | null> {
    if (
      !this.hasReducedHours(doctorMap, oldDoctorId) ||
      this.hasReducedHours(doctorMap, newDoctorId)
    ) {
      return null;
    }

    return manager.getRepository(RotaAssignmentEntity).findOne({
      where: {
        rotaId,
        date,
        doctorId: newDoctorId,
        assignmentKind: 'refuerzo',
        linkedPrimaryDoctorId: oldDoctorId,
      },
    });
  }

  private async syncPrimaryRefuerzoState(
    manager: EntityManager,
    rota: RotaEntity,
    assignment: RotaAssignmentEntity,
    oldDoctorId: string,
    newDoctorId: string,
    doctorMap: Map<string, DoctorInput>,
  ): Promise<string[]> {
    const warnings: string[] = [];
    if (rota.rotaType !== 'AC') {
      return warnings;
    }

    const assignmentRepository = manager.getRepository(RotaAssignmentEntity);
    const primaryAssignments = await assignmentRepository.find({
      where: {
        rotaId: rota.id,
        date: assignment.date,
        assignmentKind: 'primary',
      },
    });
    if (primaryAssignments.length !== 1) {
      return warnings;
    }

    const linkedRefuerzos = await assignmentRepository.find({
      where: {
        rotaId: rota.id,
        date: assignment.date,
        assignmentKind: 'refuerzo',
        linkedPrimaryDoctorId: oldDoctorId,
      },
    });

    const oldReduced = this.hasReducedHours(doctorMap, oldDoctorId);
    const newReduced = this.hasReducedHours(doctorMap, newDoctorId);

    if (oldReduced && !newReduced) {
      if (linkedRefuerzos.length > 0) {
        await assignmentRepository.remove(linkedRefuerzos);
      }
      return warnings;
    }

    if (oldReduced && newReduced) {
      if (linkedRefuerzos.length === 0) {
        const assigned = await this.assignAutomaticRefuerzo(
          manager,
          rota,
          assignment,
          newDoctorId,
          doctorMap,
        );
        if (!assigned) {
          warnings.push(
            `${assignment.date} now needs a refuerzo for reduced-hours doctor ${
              doctorMap.get(newDoctorId)?.name ?? newDoctorId
            }.`,
          );
        }
      } else {
        linkedRefuerzos.forEach((refuerzo) => {
          refuerzo.linkedPrimaryDoctorId = newDoctorId;
        });
        await assignmentRepository.save(linkedRefuerzos);
      }
      return warnings;
    }

    if (!oldReduced && newReduced && linkedRefuerzos.length === 0) {
      const assigned = await this.assignAutomaticRefuerzo(
        manager,
        rota,
        assignment,
        newDoctorId,
        doctorMap,
      );
      if (!assigned) {
        warnings.push(
          `${assignment.date} now needs a refuerzo for reduced-hours doctor ${
            doctorMap.get(newDoctorId)?.name ?? newDoctorId
          }.`,
        );
      }
    }

    return warnings;
  }

  private async assignAutomaticRefuerzo(
    manager: EntityManager,
    rota: RotaEntity,
    primaryAssignment: RotaAssignmentEntity,
    linkedPrimaryDoctorId: string,
    doctorMap: Map<string, DoctorInput>,
  ): Promise<boolean> {
    const assignmentRepository = manager.getRepository(RotaAssignmentEntity);
    const sameDayAssignments = await assignmentRepository.find({
      where: {
        rotaId: rota.id,
        date: primaryAssignment.date,
      },
    });
    const previousDayAssignments = await assignmentRepository.find({
      where: {
        rotaId: rota.id,
        date: addDays(primaryAssignment.date, -1),
      },
    });
    const allAssignments = await assignmentRepository.find({
      where: { rotaId: rota.id },
    });

    const totalHours = new Map<string, number>();
    for (const doctor of doctorMap.values()) {
      totalHours.set(doctor.id, 0);
    }
    for (const assignment of allAssignments) {
      totalHours.set(
        assignment.doctorId,
        (totalHours.get(assignment.doctorId) ?? 0) + assignment.durationHours,
      );
    }

    const sameDayTaken = new Set(sameDayAssignments.map((assignment) => assignment.doctorId));
    const previousDayAssigned = new Set(
      previousDayAssignments.map((assignment) => assignment.doctorId),
    );

    const candidates = [...doctorMap.values()].filter(
      (doctor) =>
        !sameDayTaken.has(doctor.id) &&
        !this.hasReducedHours(doctorMap, doctor.id),
    );
    const restedCandidates = candidates.filter(
      (doctor) => !previousDayAssigned.has(doctor.id),
    );
    const availableCandidates =
      restedCandidates.length > 0 ? restedCandidates : candidates;

    if (availableCandidates.length === 0) {
      return false;
    }

    availableCandidates.sort((left, right) => {
      const totalHoursDiff =
        (totalHours.get(left.id) ?? 0) - (totalHours.get(right.id) ?? 0);
      if (totalHoursDiff !== 0) {
        return totalHoursDiff;
      }

      return left.id.localeCompare(right.id);
    });

    const chosenDoctor = availableCandidates[0];
    const details = refuerzoDetails(primaryAssignment.dayType as DayType);
    await assignmentRepository.save(
      assignmentRepository.create({
        rotaId: rota.id,
        date: primaryAssignment.date,
        dayType: primaryAssignment.dayType,
        shiftStart: details.shiftStart,
        shiftEnd: details.shiftEnd,
        durationHours: details.durationHours,
        doctorId: chosenDoctor.id,
        assignmentKind: 'refuerzo',
        linkedPrimaryDoctorId,
      }),
    );

    return true;
  }

  private async createMissingRefuerzo(
    manager: EntityManager,
    rota: RotaEntity,
    request: ReplaceDoctorDto,
    doctorMap: Map<string, DoctorInput>,
  ): Promise<void> {
    if (rota.rotaType !== 'AC') {
      throw new BadRequestException(
        'Refuerzo assignments can only be created on AC rotas.',
      );
    }

    if (!request.linked_primary_doctor_id) {
      throw new NotFoundException(
        `Doctor ${request.old_doctor_id} is not assigned as ${
          request.assignment_kind ?? 'primary'
        } on ${request.date}.`,
      );
    }

    const assignmentRepository = manager.getRepository(RotaAssignmentEntity);
    const primaryAssignment = await assignmentRepository.findOne({
      where: {
        rotaId: rota.id,
        date: request.date,
        doctorId: request.linked_primary_doctor_id,
        assignmentKind: 'primary',
      },
    });
    if (!primaryAssignment) {
      throw new BadRequestException(
        `Doctor ${request.linked_primary_doctor_id} is not assigned as primary on ${request.date}.`,
      );
    }

    if (!this.hasReducedHours(doctorMap, request.linked_primary_doctor_id)) {
      throw new BadRequestException(
        `Doctor ${request.linked_primary_doctor_id} does not require a refuerzo on ${request.date}.`,
      );
    }

    const primaryCount = await assignmentRepository.count({
      where: {
        rotaId: rota.id,
        date: request.date,
        assignmentKind: 'primary',
      },
    });
    if (primaryCount !== 1) {
      throw new BadRequestException(
        'Refuerzo can only be assigned when there is exactly one primary doctor that day.',
      );
    }

    const existingRefuerzo = await assignmentRepository.findOne({
      where: {
        rotaId: rota.id,
        date: request.date,
        assignmentKind: 'refuerzo',
        linkedPrimaryDoctorId: request.linked_primary_doctor_id,
      },
    });
    if (existingRefuerzo) {
      throw new BadRequestException(
        `Doctor ${request.linked_primary_doctor_id} already has a refuerzo assigned on ${request.date}.`,
      );
    }

    const details = refuerzoDetails(primaryAssignment.dayType as DayType);
    await assignmentRepository.save(
      assignmentRepository.create({
        rotaId: rota.id,
        date: request.date,
        dayType: primaryAssignment.dayType,
        shiftStart: details.shiftStart,
        shiftEnd: details.shiftEnd,
        durationHours: details.durationHours,
        doctorId: request.new_doctor_id,
        assignmentKind: 'refuerzo',
        linkedPrimaryDoctorId: request.linked_primary_doctor_id,
      }),
    );
  }
}
