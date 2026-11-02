import { addDays, toIsoDate } from '../../common/date.utils';
import { InfeasiblePoolError } from '../errors';
import { DayType, DoctorInput, ShiftRole } from '../scheduling.types';
import { AssignmentStrategy, StrategyInput, splitSlots } from './assignment-strategy';

/**
 * Round-robin equilibrado: cada día elige, entre los médicos descansados, a quien
 * tenga menos turnos del mismo papel (guardia o refuerzo) y tipo de día, luego menos
 * horas y, por último, quien quede más cerca de un puntero deslizante (evita el
 * bloqueo de grupo). Primero se cubren las guardias del día y después los refuerzos;
 * nadie hace las dos cosas el mismo día.
 */
export const balancedStrategy: AssignmentStrategy = {
  id: 'balanced',

  assign(input: StrategyInput): DoctorInput[][] {
    const { pool, days } = input;
    const doctorIds = pool.map((doctor) => doctor.id);
    const doctorMap = new Map(pool.map((doctor) => [doctor.id, doctor]));
    const doctorIndex = new Map(doctorIds.map((doctorId, index) => [doctorId, index]));

    const lastAssigned = new Map<string, string>();
    const totalHours = new Map<string, number>(doctorIds.map((doctorId) => [doctorId, 0]));
    const shiftCounts = new Map<string, number>();
    const countKey = (doctorId: string, role: ShiftRole, dayType: DayType) =>
      `${doctorId}|${role}|${dayType}`;
    const countOf = (doctorId: string, role: ShiftRole, dayType: DayType) =>
      shiftCounts.get(countKey(doctorId, role, dayType)) ?? 0;

    let roundRobinPointer = 0;
    const result: DoctorInput[][] = [];

    for (const [dayIndex, dayInfo] of days.entries()) {
      const currentDate = toIsoDate(dayInfo.date);
      const previousDay = addDays(currentDate, -1);
      const slots = splitSlots(input, dayIndex);
      const required = slots.guardia + slots.refuerzo;

      const rested: string[] = [];
      const unrested: string[] = [];
      for (const doctorId of doctorIds) {
        if (lastAssigned.get(doctorId) === previousDay) {
          unrested.push(doctorId);
        } else {
          rested.push(doctorId);
        }
      }

      const availableToday = rested.length >= required ? rested : [...rested, ...unrested];
      if (availableToday.length < required) {
        throw new InfeasiblePoolError(
          `No hay suficientes médicos elegibles el ${currentDate}. El grupo es demasiado pequeño.`,
        );
      }

      const rotatedIndex = (doctorId: string) =>
        ((doctorIndex.get(doctorId) ?? 0) - roundRobinPointer + pool.length) % pool.length;
      const chosen: string[] = [];
      const pick = (role: ShiftRole, count: number) => {
        const picked = availableToday
          .filter((doctorId) => !chosen.includes(doctorId))
          .sort((left, right) => {
            const comparisons = [
              countOf(left, role, dayInfo.dayType) - countOf(right, role, dayInfo.dayType),
              (totalHours.get(left) ?? 0) - (totalHours.get(right) ?? 0),
              rotatedIndex(left) - rotatedIndex(right),
            ];
            return comparisons.find((comparison) => comparison !== 0) ?? 0;
          })
          .slice(0, count);

        for (const doctorId of picked) {
          const key = countKey(doctorId, role, dayInfo.dayType);
          shiftCounts.set(key, (shiftCounts.get(key) ?? 0) + 1);
        }
        chosen.push(...picked);
      };

      pick('guardia', slots.guardia);
      pick('refuerzo', slots.refuerzo);

      roundRobinPointer = (roundRobinPointer + 1) % pool.length;

      for (const doctorId of chosen) {
        lastAssigned.set(doctorId, currentDate);
        totalHours.set(doctorId, (totalHours.get(doctorId) ?? 0) + dayInfo.durationHours);
      }

      result.push(chosen.map((doctorId) => doctorMap.get(doctorId) as DoctorInput));
    }

    return result;
  },
};
