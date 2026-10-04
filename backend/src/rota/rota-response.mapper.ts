import { Injectable } from '@nestjs/common';

import {
  formatClockTime,
  formatShiftEnd,
  fromIsoDate,
  toIsoDate,
} from '../common/date.utils';
import { buildTargetHours } from '../scheduling/assignment.service';
import { calculateStats } from '../scheduling/stats.service';
import { DayAssignment as DomainDayAssignment, DoctorInput } from '../scheduling/scheduling.types';
import { RotaResponse, RotaType, StatsResponse } from './rota.types';
import { RotaAssignmentEntity } from './entities/rota-assignment.entity';
import { RotaEntity } from './entities/rota.entity';

@Injectable()
export class RotaResponseMapper {
  toResponse(rota: RotaEntity, doctorIdFilter?: string): RotaResponse {
    const pool = rota.pool as DoctorInput[];
    const doctorMap = new Map(pool.map((doctor) => [doctor.id, doctor]));
    const targetHours = buildTargetHours(rota.rotaType as RotaType, pool);

    // Desempate por id: sin ORDER BY el motor devuelve las filas del mismo día en el orden
    // que le conviene (el de un índice en MySQL); el id fija el orden de inserción.
    const allAssignments = [...rota.assignments].sort(
      (left, right) => left.date.localeCompare(right.date) || left.id - right.id,
    );
    const filteredAssignments = doctorIdFilter
      ? allAssignments.filter((assignment) => assignment.doctorId === doctorIdFilter)
      : allAssignments;

    const schedule = this.buildApiSchedule(filteredAssignments, doctorMap);
    const allSchedule = this.buildDomainSchedule(allAssignments, doctorMap);
    const statsList = calculateStats(allSchedule, pool, targetHours);
    const stats: StatsResponse = {
      doctors: statsList.map((doctor) => ({
        doctor_id: doctor.doctorId,
        doctor_name: doctor.doctorName,
        total_hours: doctor.totalHours,
        target_hours: doctor.targetHours,
        hours_vs_target: doctor.hoursVsTarget,
        monthly_hours: doctor.monthlyHours,
        shifts_weekday: doctor.shiftsWeekday,
        shifts_saturday: doctor.shiftsSaturday,
        shifts_sunday_holiday: doctor.shiftsSundayHoliday,
      })),
    };

    return {
      year: rota.year,
      city: rota.city,
      rota_type: rota.rotaType as RotaType,
      doctors_per_day: rota.doctorsPerDay,
      generated_at: rota.generatedAt,
      schedule,
      stats,
      warnings: [],
    };
  }

  private buildDomainSchedule(
    assignments: RotaAssignmentEntity[],
    doctorMap: Map<string, DoctorInput>,
  ): DomainDayAssignment[] {
    const grouped = new Map<string, RotaAssignmentEntity[]>();
    for (const assignment of assignments) {
      const key = assignment.date;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)?.push(assignment);
    }

    return [...grouped.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, rows]) => {
        const first = rows[0];

        return {
          date: fromIsoDate(date),
          dayType: first.dayType as DomainDayAssignment['dayType'],
          shiftStart: formatClockTime(first.shiftStart),
          shiftEnd: formatShiftEnd(first.shiftStart, first.shiftEnd),
          durationHours: first.durationHours,
          doctors: rows.map((assignment) => ({
            doctorId: assignment.doctorId,
            doctorName: doctorMap.get(assignment.doctorId)?.name ?? assignment.doctorId,
          })),
        };
      });
  }

  private buildApiSchedule(assignments: RotaAssignmentEntity[], doctorMap: Map<string, DoctorInput>) {
    return this.buildDomainSchedule(assignments, doctorMap).map((day) => ({
      date: toIsoDate(day.date),
      day_type: day.dayType,
      shift_start: day.shiftStart,
      shift_end: day.shiftEnd,
      duration_hours: day.durationHours,
      doctors: day.doctors.map((doctor) => ({
        doctor_id: doctor.doctorId,
        doctor_name: doctor.doctorName,
      })),
    }));
  }
}
