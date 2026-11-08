import { addDays, toIsoDate } from "../../common/date.utils";
import { InfeasiblePoolError } from "../errors";
import { DayInfo, DoctorInput } from "../scheduling.types";
import { AssignmentStrategy, StrategyInput, splitSlots } from "./assignment-strategy";

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
 * una recorre el grupo en el orden de la lista recibida con su propio puntero. Los
 * punteros arrancan escalonados (`staggeredInitialPointers`) cada año, sin estado entre años. Cada asignación
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
    return assignWithWheels(input, staggeredInitialPointers(input.pool.length));
  },
};

/**
 * Punteros iniciales escalonados: laborables 0, sábados ⌊N/4⌋, domingos ⌊2N/4⌋ y
 * festivos ⌊3N/4⌋ (N = tamaño del grupo).
 *
 * Si todas las ruedas arrancaran desde el primer médico, la cabeza de la lista
 * recibiría a la vez el primer turno de todas las ruedas y, a partir de ahí, el +1
 * de cada rueda coincidiría sobre los mismos médicos. Repartir los orígenes reparte
 * también esa carga (ver docs/STRATEGY_COMPARISON.md).
 */
export function staggeredInitialPointers(poolSize: number): Record<WheelId, number> {
  return {
    weekday: 0,
    saturday: Math.floor(poolSize / 4),
    sunday: Math.floor((2 * poolSize) / 4),
    holiday: Math.floor((3 * poolSize) / 4),
  };
}

/**
 * Implementación de la estrategia con punteros iniciales parametrizables. Se exporta
 * para análisis y pruebas (p. ej. la variante «todas desde el primero» en
 * `scripts/compare-strategies.ts`); sin punteros explícitos todas las ruedas arrancan en
 * el índice 0. El producto pasa `staggeredInitialPointers`.
 *
 * Guardias y refuerzos tienen cada uno su juego de cuatro ruedas. Las de refuerzo
 * arrancan desplazadas ⌊N/2⌋ respecto a las de guardia, para que la guardia y el
 * refuerzo de un mismo día no recaigan en médicos contiguos de la lista. Cada día se
 * cubren primero las guardias y después los refuerzos; un médico elegido para la
 * guardia no está disponible para el refuerzo de ese día.
 *
 * `breakWeeklyResonance` (activada por defecto) aplica la corrección de la
 * resonancia semanal; ver `startsFullWorkWeek`.
 *
 * `singleGuardiaWheel` (desactivada por defecto) hace que las guardias recorran una
 * única rueda para todos los días, sea laborable, sábado, domingo, festivo o festivo
 * especial; arranca en el puntero de laborables. Los refuerzos siguen con sus cuatro
 * ruedas. La corrección de la resonancia semanal no se aplica a la rueda única: no es
 * una rueda de laborables.
 *
 * `breakLapResonance` (activada por defecto) corrige la resonancia de la rueda única:
 * si el tamaño del grupo es múltiplo de 7, cada vuelta de la rueda dura un número exacto
 * de semanas y cada médico caería siempre el mismo día de la semana. Por eso, cada N
 * días (N = tamaño del grupo) la rueda de guardias avanza un puesto SIN apuntar deuda.
 * El saltado hace el último día de esa vuelta, así que nadie pierde guardias, y el día
 * de la semana de cada médico se desplaza uno en cada vuelta. No afecta a `wheels`.
 */
export function assignWithWheels(
  input: StrategyInput,
  initialPointers: Partial<Record<WheelId, number>> = {},
  {
    breakWeeklyResonance = true,
    singleGuardiaWheel = false,
    breakLapResonance = true,
  }: {
    breakWeeklyResonance?: boolean;
    singleGuardiaWheel?: boolean;
    breakLapResonance?: boolean;
  } = {},
): DoctorInput[][] {
  const { pool, days } = input;
  const size = pool.length;
  const doctorById = new Map(pool.map((doctor) => [doctor.id, doctor]));
  const buildWheels = (offset: number): Record<WheelId, Wheel> => {
    const start = (wheel: WheelId): number =>
      ((initialPointers[wheel] ?? 0) + offset) % size;
    return {
      weekday: { pointer: start("weekday"), pending: [] },
      saturday: { pointer: start("saturday"), pending: [] },
      sunday: { pointer: start("sunday"), pending: [] },
      holiday: { pointer: start("holiday"), pending: [] },
    };
  };
  // Rueda única: los cuatro tipos de día comparten el mismo objeto (puntero y deuda).
  const buildSingleWheel = (): Record<WheelId, Wheel> => {
    const wheel: Wheel = { pointer: (initialPointers.weekday ?? 0) % size, pending: [] };
    return { weekday: wheel, saturday: wheel, sunday: wheel, holiday: wheel };
  };
  const wheelsByRole = {
    guardia: singleGuardiaWheel ? buildSingleWheel() : buildWheels(0),
    refuerzo: buildWheels(Math.floor(size / 2)),
  };
  const rolesWithWeekdayWheel = singleGuardiaWheel
    ? (["refuerzo"] as const)
    : (["guardia", "refuerzo"] as const);
  const lastAssigned = new Map<string, string>();
  const result: DoctorInput[][] = [];

  for (const [dayIndex, day] of days.entries()) {
    // Corrección de la resonancia: con tantos médicos como laborables tiene la semana, la
    // rueda de laborables da una vuelta exacta cada semana y cada médico cae siempre el
    // mismo día (el del viernes no llega nunca al sábado). Como se hace a mano, el lunes
    // de cada semana de 5 laborables se salta un puesto SIN apuntar deuda: el saltado
    // hace el viernes, así que nadie pierde guardias y el día de cada uno va rotando.
    if (breakWeeklyResonance && size === WORKDAYS_PER_WEEK && startsFullWorkWeek(days, dayIndex)) {
      for (const role of rolesWithWeekdayWheel) {
        const wheel = wheelsByRole[role].weekday;
        wheel.pointer = (wheel.pointer + 1) % size;
      }
    }

    // Lo mismo para la rueda única con grupos múltiplos de 7: cada N días gira un puesto
    // sin deuda, para que nadie quede fijo en el mismo día de la semana.
    if (
      breakLapResonance &&
      singleGuardiaWheel &&
      size % DAYS_PER_WEEK === 0 &&
      dayIndex > 0 &&
      dayIndex % size === 0
    ) {
      const wheel = wheelsByRole.guardia.weekday;
      wheel.pointer = (wheel.pointer + 1) % size;
    }

    const currentDate = toIsoDate(day.date);
    const previousDate = addDays(currentDate, -1);
    const slots = splitSlots(input, dayIndex);
    const required = slots.guardia + slots.refuerzo;
    const wheelId = wheelForDay(day);
    const isRested = (doctorId: string): boolean =>
      lastAssigned.get(doctorId) !== previousDate;

    if (size < required) {
      throw new InfeasiblePoolError(
        `No hay suficientes médicos elegibles el ${currentDate}. El grupo es demasiado pequeño.`,
      );
    }

    const chosen: string[] = [];
    const fill = (wheel: Wheel, count: number): void => {
      const target = chosen.length + count;
      const isFree = (doctorId: string): boolean =>
        isRested(doctorId) && !chosen.includes(doctorId);
      const freeCount = pool.filter((doctor) => isFree(doctor.id)).length;

      if (freeCount >= count) {
        // Primero la deuda de la rueda (FIFO): sólo quien esté descansado y aún no
        // elegido hoy; cada elección consume una única deuda (la más antigua suya).
        for (const doctorId of [...wheel.pending]) {
          if (chosen.length < target && isFree(doctorId)) {
            chosen.push(doctorId);
            wheel.pending.splice(wheel.pending.indexOf(doctorId), 1);
          }
        }
        // Después la rueda; quien no pueda salir hoy se salta y suma una deuda.
        for (let step = 0; chosen.length < target && step < size; step += 1) {
          const doctorId = pool[wheel.pointer].id;
          wheel.pointer = (wheel.pointer + 1) % size;
          if (isFree(doctorId)) {
            chosen.push(doctorId);
          } else {
            wheel.pending.push(doctorId);
          }
        }
        if (chosen.length < target) {
          throw new InfeasiblePoolError(
            `No hay suficientes médicos elegibles el ${currentDate}. El grupo es demasiado pequeño.`,
          );
        }
        return;
      }

      // Orden de rueda: pendientes primero y luego la rueda desde su puntero.
      // `offset` es la distancia al puntero (null si viene de la cola de pendientes).
      const candidates: { id: string; offset: number | null }[] = [
        ...wheel.pending.map((id) => ({ id, offset: null })),
        ...pool.map((_, offset) => ({
          id: pool[(wheel.pointer + offset) % size].id,
          offset,
        })),
      ];
      const seen = new Set<string>(chosen);
      const ordered = candidates.filter(
        (entry) => !seen.has(entry.id) && seen.add(entry.id),
      );
      const picks = [
        ...ordered.filter((entry) => isRested(entry.id)),
        ...ordered.filter((entry) => !isRested(entry.id)),
      ].slice(0, count);

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
    };

    fill(wheelsByRole.guardia[wheelId], slots.guardia);
    if (slots.refuerzo > 0) {
      fill(wheelsByRole.refuerzo[wheelId], slots.refuerzo);
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

const WORKDAYS_PER_WEEK = 5;
const DAYS_PER_WEEK = 7;

/**
 * Cierto si `days[index]` es un lunes y los cinco días siguientes del calendario (lunes a
 * viernes) son laborables que van a la rueda de laborables. Una semana con un festivo entre
 * semana ya descoloca la rueda por sí sola, y una semana partida (fin de año) no se toca.
 */
export function startsFullWorkWeek(days: DayInfo[], index: number): boolean {
  const monday = days[index];
  if (!monday || monday.date.getUTCDay() !== 1) {
    return false;
  }
  for (let offset = 0; offset < WORKDAYS_PER_WEEK; offset += 1) {
    const candidate = days[index + offset];
    if (
      !candidate ||
      toIsoDate(candidate.date) !== addDays(toIsoDate(monday.date), offset) ||
      wheelForDay(candidate) !== "weekday"
    ) {
      return false;
    }
  }
  return true;
}
