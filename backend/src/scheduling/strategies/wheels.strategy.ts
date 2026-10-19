import { addDays, toIsoDate } from "../../common/date.utils";
import { InfeasiblePoolError } from "../errors";
import { DayInfo, DoctorInput } from "../scheduling.types";
import { AssignmentStrategy, StrategyInput } from "./assignment-strategy";

export type WheelId = "weekday" | "saturday" | "sunday" | "holiday";

/**
 * Rueda a la que pertenece un día. Un festivo oficial va siempre a la rueda de
 * festivos aunque caiga en sábado o domingo; un domingo normal tiene la suya.
 */
export function wheelForDay(day: DayInfo): WheelId {
  if (day.publicHoliday) {
    return "holiday";
  }
  const weekday = day.date.getUTCDay();
  if (weekday === 0) {
    return "sunday";
  }
  return weekday === 6 ? "saturday" : "weekday";
}

interface Wheel {
  pointer: number;
  // Turnos debidos, en orden FIFO: cada salto añade una entrada, de modo que un mismo
  // médico puede aparecer varias veces (una por turno que se le ha saltado).
  pending: string[];
}

/**
 * Estrategia de ruedas: replica el cuadrante hecho a mano.
 *
 * Hay cuatro ruedas independientes (laborables, sábados, domingos, festivos). Cada
 * una recorre el grupo en el orden de la lista recibida con su propio puntero y todas
 * arrancan en el primer médico cada año (sin estado entre años). Cada asignación
 * avanza el puntero de su rueda; si un día requiere varios médicos se toman los
 * siguientes de la rueda.
 *
 * Choque con el día de descanso: "saltar y conservar turno". Un médico no está
 * descansado si hizo guardia el día anterior (en cualquier rueda) o ya ha sido
 * elegido ese mismo día. Si le toca en su rueda y no está descansado, se salta, el
 * puntero avanza sobre él y se anota una deuda en la cola de pendientes de esa rueda.
 * Cada salto genera una deuda, aunque el médico ya tuviera otras: la cola admite
 * repeticiones. Al llenar un día se consideran primero los pendientes (FIFO) y
 * después la rueda desde su puntero; elegir a alguien de la cola consume UNA deuda.
 * Un médico nunca sale dos veces el mismo día, aunque acumule varias deudas.
 *
 * Descanso blando: si en todo el grupo no hay suficientes descansados para cubrir el
 * día, se completa con no descansados siguiendo el orden de la rueda (pendientes
 * primero). Esos huecos no generan deuda nueva: no se ha saltado a nadie, se ha
 * incumplido el descanso porque no había alternativa. Esta rama es inalcanzable
 * desde `generateRota` (su tamaño mínimo de grupo, 2 × pico de cobertura, garantiza
 * siempre suficientes descansados) y sólo existe por robustez ante llamadas directas.
 */
export const wheelsStrategy: AssignmentStrategy = {
  id: "wheels",

  assign(input: StrategyInput): DoctorInput[][] {
    return assignWithWheels(input);
  },
};

/**
 * Implementación de la estrategia con punteros iniciales parametrizables. Se exporta
 * sólo para análisis y pruebas (p. ej. ruedas escalonadas en `scripts/compare-strategies.ts`);
 * por defecto todas las ruedas arrancan en el índice 0, que es lo que usa el producto.
 */
export function assignWithWheels(
  { pool, days, requiredByDay }: StrategyInput,
  initialPointers: Partial<Record<WheelId, number>> = {},
): DoctorInput[][] {
  const size = pool.length;
  const doctorById = new Map(pool.map((doctor) => [doctor.id, doctor]));
  const start = (wheel: WheelId): number =>
    (initialPointers[wheel] ?? 0) % size;
  const wheels: Record<WheelId, Wheel> = {
    weekday: { pointer: start("weekday"), pending: [] },
    saturday: { pointer: start("saturday"), pending: [] },
    sunday: { pointer: start("sunday"), pending: [] },
    holiday: { pointer: start("holiday"), pending: [] },
  };
  const lastAssigned = new Map<string, string>();
  const result: DoctorInput[][] = [];

  for (const [dayIndex, day] of days.entries()) {
    const currentDate = toIsoDate(day.date);
    const previousDate = addDays(currentDate, -1);
    const required = requiredByDay[dayIndex];
    const wheel = wheels[wheelForDay(day)];
    const isRested = (doctorId: string): boolean =>
      lastAssigned.get(doctorId) !== previousDate;

    if (size < required) {
      throw new InfeasiblePoolError(
        `No hay suficientes médicos elegibles el ${currentDate}. El grupo es demasiado pequeño.`,
      );
    }

    const restedCount = pool.filter((doctor) => isRested(doctor.id)).length;
    const chosen: string[] = [];

    if (restedCount >= required) {
      // Primero la deuda de la rueda (FIFO): sólo quien esté descansado y aún no
      // elegido hoy; cada elección consume una única deuda (la más antigua suya).
      for (const doctorId of [...wheel.pending]) {
        if (
          chosen.length < required &&
          isRested(doctorId) &&
          !chosen.includes(doctorId)
        ) {
          chosen.push(doctorId);
          wheel.pending.splice(wheel.pending.indexOf(doctorId), 1);
        }
      }
      // Después la rueda; quien no pueda salir hoy se salta y suma una deuda.
      for (let step = 0; chosen.length < required && step < size; step += 1) {
        const doctorId = pool[wheel.pointer].id;
        wheel.pointer = (wheel.pointer + 1) % size;
        if (isRested(doctorId) && !chosen.includes(doctorId)) {
          chosen.push(doctorId);
        } else {
          wheel.pending.push(doctorId);
        }
      }
      if (chosen.length < required) {
        throw new InfeasiblePoolError(
          `No hay suficientes médicos elegibles el ${currentDate}. El grupo es demasiado pequeño.`,
        );
      }
    } else {
      // Orden de rueda: pendientes primero y luego la rueda desde su puntero.
      // `offset` es la distancia al puntero (null si viene de la cola de pendientes).
      const candidates: { id: string; offset: number | null }[] = [
        ...wheel.pending.map((id) => ({ id, offset: null })),
        ...pool.map((_, offset) => ({
          id: pool[(wheel.pointer + offset) % size].id,
          offset,
        })),
      ];
      const seen = new Set<string>();
      const ordered = candidates.filter(
        (entry) => !seen.has(entry.id) && seen.add(entry.id),
      );
      const picks = [
        ...ordered.filter((entry) => isRested(entry.id)),
        ...ordered.filter((entry) => !isRested(entry.id)),
      ].slice(0, required);

      let furthest = -1;
      for (const pick of picks) {
        chosen.push(pick.id);
        if (pick.offset === null) {
          wheel.pending.splice(wheel.pending.indexOf(pick.id), 1);
        } else {
          furthest = Math.max(furthest, pick.offset);
        }
      }
      wheel.pointer = (wheel.pointer + furthest + 1) % size;
    }

    for (const doctorId of chosen) {
      lastAssigned.set(doctorId, currentDate);
    }
    result.push(
      chosen.map((doctorId) => doctorById.get(doctorId) as DoctorInput),
    );
  }

  return result;
}
