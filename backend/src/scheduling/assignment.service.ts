import { addDays, compareIsoDates, getIsoWeekday, toIsoDate } from '../common/date.utils';
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
export const AP_MAX_HOURS_YEAR = 425;

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

const SUNDAY_ISO_WEEKDAY = 6;

// El segundo refuerzo AP sólo se aplica a un festivo cuyo día anterior también
// es festivo. Sin `previousDay` (1 de enero cuando no se conoce el 31 de diciembre
// anterior) sólo se sabe que el día anterior es festivo si cae en domingo.
export function doctorsForDay(
  rotaType: RotaType,
  baseDoctorsPerDay: number,
  day: DayInfo,
  previousDay?: DayInfo,
): number {
  if (rotaType !== 'AP' || day.dayType !== 'holiday') {
    return baseDoctorsPerDay;
  }
  const previousIsHoliday = previousDay
    ? previousDay.dayType === 'holiday'
    : getIsoWeekday(addDays(toIsoDate(day.date), -1)) === SUNDAY_ISO_WEEKDAY;

  return previousIsHoliday ? Math.max(baseDoctorsPerDay, 2) : baseDoctorsPerDay;
}

export function computeDoctorsPerDay(
  rotaType: RotaType,
  poolSize: number,
  totalYearlyHours: number,
  targetHours?: Record<string, number>,
): number {
  const minTotalHours = targetHours
    ? Object.values(targetHours).reduce((sum, value) => sum + value, 0)
    : poolSize * (rotaType === 'AC' ? AC_MIN_HOURS_YEAR : AP_MAX_HOURS_YEAR);

  return Math.ceil(minTotalHours / totalYearlyHours);
}

export function buildTargetHours(
  rotaType: RotaType,
  pool: DoctorInput[],
): Record<string, number> {
  return Object.fromEntries(
    pool.map((doctor) => [
      doctor.id,
      rotaType === 'AC' ? AC_MIN_HOURS_YEAR : AP_MAX_HOURS_YEAR,
    ]),
  );
}

export function generateRota(
  year: number,
  rotaType: RotaType,
  pool: DoctorInput[],
  dayClassifications: DayInfo[],
  dayBeforeYear?: DayInfo,
): RotaSchedule {
  const effectiveDays = dayClassifications.map((day) => effectiveDayInfo(rotaType, day));
  const targetHours = buildTargetHours(rotaType, pool);

  if (pool.length < 1) {
    throw new InfeasiblePoolError(`El grupo debe tener al menos 1 médico (tiene ${pool.length}).`);
  }

  const doctorsPerDay = 1;

  const requiredByDay = effectiveDays.map((day, index) =>
    doctorsForDay(rotaType, doctorsPerDay, day, effectiveDays[index - 1] ?? dayBeforeYear),
  );

  let peakDoctorsPerDay = doctorsPerDay;
  let totalCapacityHours = 0;
  effectiveDays.forEach((day, index) => {
    const required = requiredByDay[index];
    if (required > peakDoctorsPerDay) {
      peakDoctorsPerDay = required;
    }
    totalCapacityHours += day.durationHours * required;
  });

  const minPool = peakDoctorsPerDay * 2;
  if (pool.length < minPool) {
    throw new InfeasiblePoolError(
      `El grupo de ${pool.length} médicos es demasiado pequeño para ${rotaType}. Se necesitan al menos ${minPool} médicos (${peakDoctorsPerDay} por día × 2 por la rotación del día de descanso).`,
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

  for (const [dayIndex, dayInfo] of effectiveDays.entries()) {
    const currentDate = toIsoDate(dayInfo.date);
    const previousDay = addDays(currentDate, -1);
    const required = requiredByDay[dayIndex];

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

  // Los límites de horas no bloquean la generación: el cuadrante se devuelve con un
  // único aviso agregado y la desviación de cada médico queda en las estadísticas.
  // AC tiene un mínimo (1.620h) y AP un máximo (425h).
  const warnings: string[] = [];
  if (rotaType === 'AC') {
    const shortfalls = stats
      .map((doctor) => doctor.targetHours - doctor.totalHours)
      .filter((shortfall) => shortfall > 0);
    if (shortfalls.length > 0) {
      const missingHours = shortfalls.reduce((sum, value) => sum + value, 0);
      const totalTargetHours = Object.values(targetHours).reduce((sum, value) => sum + value, 0);
      const cause =
        totalCapacityHours < totalTargetHours
          ? `El grupo de ${pool.length} médicos es demasiado grande para ${rotaType}: el objetivo de ${totalTargetHours}h supera la capacidad anual de cobertura de ${totalCapacityHours}h. `
          : '';
      const below =
        shortfalls.length === 1
          ? '1 médico queda'
          : `${shortfalls.length} médicos quedan`;
      warnings.push(
        `${cause}${below} por debajo del mínimo de ${AC_MIN_HOURS_YEAR}h; faltan ${missingHours}h en total.`,
      );
    }
  } else {
    const excesses = stats
      .map((doctor) => doctor.totalHours - doctor.targetHours)
      .filter((excess) => excess > 0);
    if (excesses.length > 0) {
      const excessHours = excesses.reduce((sum, value) => sum + value, 0);
      const totalTargetHours = Object.values(targetHours).reduce((sum, value) => sum + value, 0);
      const minDoctors = Math.ceil(totalCapacityHours / AP_MAX_HOURS_YEAR);
      const cause =
        totalCapacityHours > totalTargetHours
          ? `El grupo de ${pool.length} médicos es demasiado pequeño para ${rotaType}: la cobertura anual de ${totalCapacityHours}h supera el máximo de ${AP_MAX_HOURS_YEAR}h por médico (se necesitan al menos ${minDoctors} médicos). `
          : '';
      const above =
        excesses.length === 1
          ? '1 médico queda'
          : `${excesses.length} médicos quedan`;
      warnings.push(
        `${cause}${above} por encima del máximo de ${AP_MAX_HOURS_YEAR}h; sobran ${excessHours}h en total.`,
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
    warnings,
  };
}
