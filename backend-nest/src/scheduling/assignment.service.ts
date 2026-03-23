import { addDays, compareIsoDates, toIsoDate } from '../common/date.utils';
import { calculateStats } from './stats.service';
import {
  DayAssignment,
  DayInfo,
  DoctorInput,
  RotaSchedule,
  RotaType,
} from './scheduling.types';

export const AC_MIN_HOURS_YEAR = 1620;
export const AC_BASE_MONTHLY_TARGET = 135;
export const AP_MIN_HOURS_YEAR = 425;

export const REFUERZO_WEEKDAY_SATURDAY_HOURS = 7;
export const REFUERZO_HOLIDAY_HOURS = 12;

export class InfeasiblePoolError extends Error {}

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
  dayClassifications: DayInfo[],
): Record<string, number> {
  if (rotaType !== 'AC') {
    return Object.fromEntries(pool.map((doctor) => [doctor.id, AP_MIN_HOURS_YEAR]));
  }

  const workingWeekdaysPerMonth = new Map<number, number>();
  for (const day of dayClassifications) {
    if (day.dayType !== 'weekday') {
      continue;
    }
    const month = day.date.getUTCMonth() + 1;
    workingWeekdaysPerMonth.set(month, (workingWeekdaysPerMonth.get(month) ?? 0) + 1);
  }

  return Object.fromEntries(
    pool.map((doctor) => {
      let yearlyTarget = 0;
      for (let month = 1; month <= 12; month += 1) {
        const monthlyTarget =
          AC_BASE_MONTHLY_TARGET -
          (doctor.hours_reduced_per_day ?? 0) * (workingWeekdaysPerMonth.get(month) ?? 0);
        yearlyTarget += Math.max(0, monthlyTarget);
      }

      return [doctor.id, Math.max(0, yearlyTarget)];
    }),
  );
}

function progressRatio(hours: number, target: number): number {
  if (target <= 0) {
    return 1;
  }

  return hours / target;
}

function refuerzoDetails(dayType: DayInfo['dayType']) {
  if (dayType === 'holiday') {
    return {
      durationHours: REFUERZO_HOLIDAY_HOURS,
      shiftStart: '10:00',
      shiftEnd: '22:00',
    };
  }

  return {
    durationHours: REFUERZO_WEEKDAY_SATURDAY_HOURS,
    shiftStart: '15:00',
    shiftEnd: '22:00',
  };
}

export function generateRota(
  year: number,
  rotaType: RotaType,
  pool: DoctorInput[],
  dayClassifications: DayInfo[],
): RotaSchedule {
  const totalYearlyHours = dayClassifications.reduce((sum, day) => sum + day.durationHours, 0);
  const normalizedPool = pool.map((doctor) => ({
    ...doctor,
    hours_reduced_per_day: doctor.hours_reduced_per_day ?? 0,
  }));
  const targetHours = buildTargetHours(rotaType, normalizedPool, dayClassifications);

  if (normalizedPool.length < 1) {
    throw new InfeasiblePoolError(
      `Pool must have at least 1 doctor (got ${normalizedPool.length}).`,
    );
  }

  const doctorsPerDay = computeDoctorsPerDay(
    rotaType,
    normalizedPool.length,
    totalYearlyHours,
    targetHours,
  );
  const minPool = doctorsPerDay * 2;
  if (normalizedPool.length < minPool) {
    throw new InfeasiblePoolError(
      `Pool of ${normalizedPool.length} is too small for ${rotaType}. Need at least ${minPool} doctors (${doctorsPerDay} per day × 2 for rest-day rotation).`,
    );
  }

  const doctorIds = normalizedPool.map((doctor) => doctor.id);
  const doctorMap = new Map(normalizedPool.map((doctor) => [doctor.id, doctor]));
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

  for (const dayInfo of dayClassifications) {
    const currentDate = toIsoDate(dayInfo.date);
    const previousDay = addDays(currentDate, -1);

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
      rested.length >= doctorsPerDay ? rested : [...rested, ...unrested];
    if (availableToday.length < doctorsPerDay) {
      throw new InfeasiblePoolError(
        `Not enough eligible doctors on ${currentDate}. Pool is too small.`,
      );
    }

    const chosen = [...availableToday]
      .sort((left, right) => {
        const comparisons = [
          dayTypeCount(left, dayInfo.dayType) - dayTypeCount(right, dayInfo.dayType),
          progressRatio(totalHours[left], targetHours[left]) -
            progressRatio(totalHours[right], targetHours[right]),
          totalHours[left] - totalHours[right],
          (((doctorIndex.get(left) ?? 0) - roundRobinPointer + normalizedPool.length) %
            normalizedPool.length) -
            (((doctorIndex.get(right) ?? 0) - roundRobinPointer + normalizedPool.length) %
              normalizedPool.length),
        ];

        return comparisons.find((comparison) => comparison !== 0) ?? 0;
      })
      .slice(0, doctorsPerDay);

    roundRobinPointer = (roundRobinPointer + 1) % normalizedPool.length;

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
      refuerzos: [],
    });
  }

  if (rotaType === 'AC') {
    const primaryByDate = new Map(
      schedule.map((day) => [
        toIsoDate(day.date),
        new Set(day.doctors.map((doctor) => doctor.doctorId)),
      ]),
    );
    const refuerzoWeekdayCount: Record<string, number> = Object.fromEntries(
      doctorIds.map((doctorId) => [doctorId, 0]),
    );
    const refuerzoSaturdayCount: Record<string, number> = Object.fromEntries(
      doctorIds.map((doctorId) => [doctorId, 0]),
    );
    const refuerzoHolidayCount: Record<string, number> = Object.fromEntries(
      doctorIds.map((doctorId) => [doctorId, 0]),
    );
    const refuerzoByDate = new Map<string, Set<string>>();
    let refuerzoPointer = 0;

    const refuerzoDayTypeCount = (doctorId: string, dayType: DayInfo['dayType']): number => {
      if (dayType === 'weekday') {
        return refuerzoWeekdayCount[doctorId];
      }
      if (dayType === 'saturday') {
        return refuerzoSaturdayCount[doctorId];
      }
      return refuerzoHolidayCount[doctorId];
    };

    for (const day of schedule) {
      if (day.doctors.length !== 1) {
        continue;
      }

      const reducedPrimaryIds = day.doctors
        .map((doctor) => doctor.doctorId)
        .filter((doctorId) => (doctorMap.get(doctorId)?.hours_reduced_per_day ?? 0) > 0);

      if (reducedPrimaryIds.length === 0) {
        continue;
      }

      const dayKey = toIsoDate(day.date);
      const previousDay = addDays(dayKey, -1);
      const sameDayTaken = new Set(primaryByDate.get(dayKey) ?? []);
      for (const doctorId of refuerzoByDate.get(dayKey) ?? []) {
        sameDayTaken.add(doctorId);
      }

      for (const primaryDoctorId of reducedPrimaryIds) {
        const previousDayAssigned = new Set(primaryByDate.get(previousDay) ?? []);
        for (const doctorId of refuerzoByDate.get(previousDay) ?? []) {
          previousDayAssigned.add(doctorId);
        }

        const rested: string[] = [];
        const unrested: string[] = [];
        for (const doctorId of doctorIds) {
          if (sameDayTaken.has(doctorId)) {
            continue;
          }
          if (previousDayAssigned.has(doctorId)) {
            unrested.push(doctorId);
          } else {
            rested.push(doctorId);
          }
        }

        let available = rested.length > 0 ? rested : [...rested, ...unrested];
        if (available.length === 0) {
          available = unrested;
        }
        if (available.length === 0) {
          throw new InfeasiblePoolError(
            `Not enough eligible doctors to cover refuerzo on ${dayKey}.`,
          );
        }

        const chosenDoctorId = [...available].sort((left, right) => {
          const comparisons = [
            progressRatio(totalHours[left], targetHours[left]) -
              progressRatio(totalHours[right], targetHours[right]),
            refuerzoDayTypeCount(left, day.dayType) - refuerzoDayTypeCount(right, day.dayType),
            totalHours[left] - totalHours[right],
            (((doctorIndex.get(left) ?? 0) - refuerzoPointer + normalizedPool.length) %
              normalizedPool.length) -
              (((doctorIndex.get(right) ?? 0) - refuerzoPointer + normalizedPool.length) %
                normalizedPool.length),
          ];

          return comparisons.find((comparison) => comparison !== 0) ?? 0;
        })[0];

        refuerzoPointer = (refuerzoPointer + 1) % normalizedPool.length;
        const details = refuerzoDetails(day.dayType);
        day.refuerzos.push({
          doctorId: chosenDoctorId,
          doctorName: doctorMap.get(chosenDoctorId)?.name ?? chosenDoctorId,
          linkedPrimaryDoctorId: primaryDoctorId,
          linkedPrimaryDoctorName: doctorMap.get(primaryDoctorId)?.name ?? primaryDoctorId,
          shiftStart: details.shiftStart,
          shiftEnd: details.shiftEnd,
          durationHours: details.durationHours,
        });

        if (!refuerzoByDate.has(dayKey)) {
          refuerzoByDate.set(dayKey, new Set());
        }
        refuerzoByDate.get(dayKey)?.add(chosenDoctorId);
        sameDayTaken.add(chosenDoctorId);

        totalHours[chosenDoctorId] += details.durationHours;
        if (day.dayType === 'weekday') {
          refuerzoWeekdayCount[chosenDoctorId] += 1;
        } else if (day.dayType === 'saturday') {
          refuerzoSaturdayCount[chosenDoctorId] += 1;
        } else {
          refuerzoHolidayCount[chosenDoctorId] += 1;
        }
      }
    }
  }

  const stats = calculateStats(schedule, normalizedPool, targetHours);
  for (const doctor of stats) {
    if (doctor.totalHours < doctor.targetHours) {
      throw new InfeasiblePoolError(
        `${doctor.doctorName} has ${doctor.totalHours}h, below the ${doctor.targetHours}h minimum for ${rotaType}.`,
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
