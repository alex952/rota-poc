import { Injectable } from '@nestjs/common';

import {
  formatClockTime,
  formatOvernightShiftEnd,
  fromIsoDate,
  toIsoDate,
} from '../common/date.utils';
import { classifyYear } from '../holidays/holidays.service';
import { buildTargetHours } from '../scheduling/assignment.service';
import { calculateStats } from '../scheduling/stats.service';
import { DayAssignment as DomainDayAssignment, DoctorInput } from '../scheduling/scheduling.types';
import { RotaResponse, RotaType, StatsResponse } from './rota.types';
import { RotaAssignmentEntity } from './entities/rota-assignment.entity';
import { RotaEntity } from './entities/rota.entity';
import { HolidaysService } from '../holidays/holidays.service';

@Injectable()
export class RotaResponseMapper {
  constructor(private readonly holidaysService: HolidaysService) {}

  async toResponse(rota: RotaEntity, doctorIdFilter?: string): Promise<RotaResponse> {
    const pool = (rota.pool as DoctorInput[]).map((doctor) => ({
      ...doctor,
      hours_reduced_per_day: doctor.hours_reduced_per_day ?? 0,
    }));
    const doctorMap = new Map(pool.map((doctor) => [doctor.id, doctor]));
    const holidayItems = await this.holidaysService.getHolidays(rota.year, rota.city);
    const holidayDates = new Set(holidayItems.map((holiday) => fromIsoDate(holiday.date)));
    const dayClassifications = classifyYear(rota.year, holidayDates);
    const targetHours = buildTargetHours(rota.rotaType as RotaType, pool, dayClassifications);

    const allAssignments = [...rota.assignments].sort((left, right) => left.date.localeCompare(right.date));
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
        primary_hours: doctor.primaryHours,
        refuerzo_hours: doctor.refuerzoHours,
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
        const primaryAssignments = rows.filter((row) => row.assignmentKind === 'primary');
        const refuerzoAssignments = rows.filter((row) => row.assignmentKind === 'refuerzo');
        const first = rows[0];

        return {
          date: fromIsoDate(date),
          dayType: first.dayType as DomainDayAssignment['dayType'],
          shiftStart: formatClockTime(first.shiftStart),
          shiftEnd: formatOvernightShiftEnd(first.shiftEnd),
          durationHours: first.durationHours,
          doctors: primaryAssignments.map((assignment) => ({
            doctorId: assignment.doctorId,
            doctorName: doctorMap.get(assignment.doctorId)?.name ?? assignment.doctorId,
          })),
          refuerzos: refuerzoAssignments.map((assignment) => ({
            doctorId: assignment.doctorId,
              doctorName: doctorMap.get(assignment.doctorId)?.name ?? assignment.doctorId,
              linkedPrimaryDoctorId: assignment.linkedPrimaryDoctorId ?? '',
              linkedPrimaryDoctorName:
                doctorMap.get(assignment.linkedPrimaryDoctorId ?? '')?.name ??
                assignment.linkedPrimaryDoctorId ??
                '',
            shiftStart: formatClockTime(assignment.shiftStart),
            shiftEnd: formatClockTime(assignment.shiftEnd),
            durationHours: assignment.durationHours,
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
      refuerzos: day.refuerzos.map((refuerzo) => ({
        doctor_id: refuerzo.doctorId,
        doctor_name: refuerzo.doctorName,
        linked_primary_doctor_id: refuerzo.linkedPrimaryDoctorId,
        linked_primary_doctor_name: refuerzo.linkedPrimaryDoctorName,
        shift_start: refuerzo.shiftStart,
        shift_end: refuerzo.shiftEnd,
        duration_hours: refuerzo.durationHours,
      })),
    }));
  }
}
