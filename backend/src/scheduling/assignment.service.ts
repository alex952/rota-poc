import { addDays, compareIsoDates, toIsoDate } from '../common/date.utils';
import { calculateStats } from './stats.service';
import {
  DayAssignment,
  DayInfo,
  DayType,
  DoctorInput,
  RotaSchedule,
  RotaType,
} from './scheduling.types';

export const AC_MIN_HOURS_YEAR = 1620;
export const AP_MIN_HOURS_YEAR = 425;

export const AP_WEEKDAY_SATURDAY_HOURS = 7;
export const AP_HOLIDAY_HOURS = 12;

export class InfeasiblePoolError extends Error {}

export function apShiftDetails(dayType: DayType): {
  durationHours: number;
  shiftStart: string;
  shiftEnd: string;
} {
  if (dayType === 'holiday') {
    return {
      durationHours: AP_HOLIDAY_HOURS,
      shiftStart: '10:00',
      shiftEnd: '22:00',
    };
  }

  return {
    durationHours: AP_WEEKDAY_SATURDAY_HOURS,
    shiftStart: '15:00',
    shiftEnd: '22:00',
  };
}

function effectiveDayInfo(rotaType: RotaType, dayInfo: DayInfo): DayInfo {
  if (rotaType !== 'AP') {
    return dayInfo;
  }
  const details = apShiftDetails(dayInfo.dayType);
  return {
    ...dayInfo,
    durationHours: details.durationHours,
    shiftStart: details.shiftStart,
    shiftEnd: details.shiftEnd,
  };
}

export function doctorsForDay(
  rotaType: RotaType,
  baseDoctorsPerDay: number,
  dayType: DayType,
): number {
  if (rotaType === 'AP' && dayType === 'holiday') {
    return Math.max(baseDoctorsPerDay, 2);
  }
  return baseDoctorsPerDay;
}

export function computeDoctorsPerDay(
  rotaType: RotaType,
  poolSize: number,
  totalYearlyHours: number,
  targetHours?: Record<string, number>,
): number {
  const minTotalHours = targetHours
    ? Object.values(targetHours).reduce((sum, value) => sum + value, 0)
    : poolSize * (rotaType === 'AC' ? AC_MIN_HOURS_YEAR : AP_MIN_HOURS_YEAR);

  return Math.ceil(minTotalHours / totalYearlyHours);
}

export function buildTargetHours(
  rotaType: RotaType,
  pool: DoctorInput[],
): Record<string, number> {
  return Object.fromEntries(
    pool.map((doctor) => [
      doctor.id,
      rotaType === 'AC' ? AC_MIN_HOURS_YEAR : AP_MIN_HOURS_YEAR,
    ]),
  );
}

export function generateRota(
  year: number,
  rotaType: RotaType,
  pool: DoctorInput[],
  dayClassifications: DayInfo[],
): RotaSchedule {
  const effectiveDays = dayClassifications.map((day) => effectiveDayInfo(rotaType, day));
  const targetHours = buildTargetHours(rotaType, pool);

  if (pool.length < 1) {
    throw new InfeasiblePoolError(`El grupo debe tener al menos 1 médico (tiene ${pool.length}).`);
  }

  const doctorsPerDay = 1;

  let peakDoctorsPerDay = doctorsPerDay;
  let totalCapacityHours = 0;
  for (const day of effectiveDays) {
    const required = doctorsForDay(rotaType, doctorsPerDay, day.dayType);
    if (required > peakDoctorsPerDay) {
      peakDoctorsPerDay = required;
    }
    totalCapacityHours += day.durationHours * required;
  }

  const minPool = peakDoctorsPerDay * 2;
  if (pool.length < minPool) {
    throw new InfeasiblePoolError(
      `El grupo de ${pool.length} médicos es demasiado pequeño para ${rotaType}. Se necesitan al menos ${minPool} médicos (${peakDoctorsPerDay} por día × 2 por la rotación del día de descanso).`,
    );
  }

  const totalTargetHours = Object.values(targetHours).reduce((sum, value) => sum + value, 0);
  if (totalCapacityHours < totalTargetHours) {
    throw new InfeasiblePoolError(
      `El grupo de ${pool.length} médicos es demasiado grande para ${rotaType}: el objetivo de ${totalTargetHours}h supera la capacidad anual de cobertura de ${totalCapacityHours}h.`,
    );
  }

  const doctorIds = pool.map((doctor) => doctor.id);
  const doctorMap = new Map(pool.map((doctor) => [doctor.id, doctor]));
  const doctorIndex = new Map(doctorIds.map((doctorId, index) => [doctorId, index]));

  const lastAssigned: Record<string, string | null> = Object.fromEntries(
    doctorIds.map((doctorId) => [doctorId, null]),
  );
  const totalHours: Record<string, number> = Object.fromEntries(
    doctorIds.map((doctorId) => [doctorId, 0]),
  );
  const weekdayCount: Record<string, number> = Object.fromEntries(
    doctorIds.map((doctorId) => [doctorId, 0]),
  );
  const saturdayCount: Record<string, number> = Object.fromEntries(
    doctorIds.map((doctorId) => [doctorId, 0]),
  );
  const holidayCount: Record<string, number> = Object.fromEntries(
    doctorIds.map((doctorId) => [doctorId, 0]),
  );

  const dayTypeCount = (doctorId: string, dayType: DayInfo['dayType']): number => {
    if (dayType === 'weekday') {
      return weekdayCount[doctorId];
    }
    if (dayType === 'saturday') {
      return saturdayCount[doctorId];
    }
    return holidayCount[doctorId];
  };

  let roundRobinPointer = 0;
  const schedule: DayAssignment[] = [];

  for (const dayInfo of effectiveDays) {
    const currentDate = toIsoDate(dayInfo.date);
    const previousDay = addDays(currentDate, -1);
    const required = doctorsForDay(rotaType, doctorsPerDay, dayInfo.dayType);

    const rested: string[] = [];
    const unrested: string[] = [];
    for (const doctorId of doctorIds) {
      if (lastAssigned[doctorId] === previousDay) {
        unrested.push(doctorId);
      } else {
        rested.push(doctorId);
      }
    }

    const availableToday =
      rested.length >= required ? rested : [...rested, ...unrested];
    if (availableToday.length < required) {
      throw new InfeasiblePoolError(
        `No hay suficientes médicos elegibles el ${currentDate}. El grupo es demasiado pequeño.`,
      );
    }

    const chosen = [...availableToday]
      .sort((left, right) => {
        const comparisons = [
          dayTypeCount(left, dayInfo.dayType) - dayTypeCount(right, dayInfo.dayType),
          totalHours[left] - totalHours[right],
          (((doctorIndex.get(left) ?? 0) - roundRobinPointer + pool.length) %
            pool.length) -
            (((doctorIndex.get(right) ?? 0) - roundRobinPointer + pool.length) %
              pool.length),
        ];

        return comparisons.find((comparison) => comparison !== 0) ?? 0;
      })
      .slice(0, required);

    roundRobinPointer = (roundRobinPointer + 1) % pool.length;

    for (const doctorId of chosen) {
      lastAssigned[doctorId] = currentDate;
      totalHours[doctorId] += dayInfo.durationHours;
      if (dayInfo.dayType === 'weekday') {
        weekdayCount[doctorId] += 1;
      } else if (dayInfo.dayType === 'saturday') {
        saturdayCount[doctorId] += 1;
      } else {
        holidayCount[doctorId] += 1;
      }
    }

    schedule.push({
      ...dayInfo,
      doctors: chosen.map((doctorId) => ({
        doctorId,
        doctorName: doctorMap.get(doctorId)?.name ?? doctorId,
      })),
    });
  }

  const stats = calculateStats(schedule, pool, targetHours);
  for (const doctor of stats) {
    if (doctor.totalHours < doctor.targetHours) {
      throw new InfeasiblePoolError(
        `${doctor.doctorName} tiene ${doctor.totalHours}h, por debajo del mínimo de ${doctor.targetHours}h para ${rotaType}.`,
      );
    }
  }

  return {
    year,
    rotaType,
    doctorsPerDay,
    schedule: [...schedule].sort((left, right) =>
      compareIsoDates(toIsoDate(left.date), toIsoDate(right.date)),
    ),
    stats: { doctors: stats },
    warnings: [],
  };
}
