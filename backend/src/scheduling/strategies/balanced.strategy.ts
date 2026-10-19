import { addDays, toIsoDate } from '../../common/date.utils';
import { InfeasiblePoolError } from '../errors';
import { DayInfo, DoctorInput } from '../scheduling.types';
import { AssignmentStrategy, StrategyInput } from './assignment-strategy';

/**
 * Round-robin equilibrado: cada día elige, entre los médicos descansados, a quien
 * tenga menos turnos del mismo tipo de día, luego menos horas y, por último, quien
 * quede más cerca de un puntero deslizante (evita el bloqueo de grupo).
 */
export const balancedStrategy: AssignmentStrategy = {
  id: 'balanced',

  assign({ pool, days, requiredByDay }: StrategyInput): DoctorInput[][] {
    const doctorIds = pool.map((doctor) => doctor.id);
    const doctorMap = new Map(pool.map((doctor) => [doctor.id, doctor]));
    const doctorIndex = new Map(doctorIds.map((doctorId, index) => [doctorId, index]));

    const zeroed = (): Record<string, number> =>
      Object.fromEntries(doctorIds.map((doctorId) => [doctorId, 0]));
    const lastAssigned: Record<string, string | null> = Object.fromEntries(
      doctorIds.map((doctorId) => [doctorId, null]),
    );
    const totalHours = zeroed();
    const weekdayCount = zeroed();
    const saturdayCount = zeroed();
    const holidayCount = zeroed();

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
    const result: DoctorInput[][] = [];

    for (const [dayIndex, dayInfo] of days.entries()) {
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

      result.push(chosen.map((doctorId) => doctorMap.get(doctorId) as DoctorInput));
    }

    return result;
  },
};
