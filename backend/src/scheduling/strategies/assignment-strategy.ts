import { DayInfo, DoctorInput } from '../scheduling.types';

export const ASSIGNMENT_STRATEGY_IDS = ['single-wheel', 'wheels'] as const;
export type AssignmentStrategyId = (typeof ASSIGNMENT_STRATEGY_IDS)[number];
export const DEFAULT_ASSIGNMENT_STRATEGY: AssignmentStrategyId = 'single-wheel';

export interface StrategyInput {
  pool: DoctorInput[];
  // Días del año en orden cronológico, ya con las duraciones efectivas (AP incluido).
  days: DayInfo[];
  // Médicos requeridos por día (mismo índice que `days`), guardias y refuerzos juntos.
  requiredByDay: number[];
  // Cuántos de los requeridos de cada día son refuerzos (los últimos). Sin él, todos son guardias.
  refuerzosByDay?: number[];
}

/**
 * Método de selección de médicos. Sólo decide quién hace cada guardia: duraciones,
 * viabilidad, estadísticas y avisos son comunes y viven en `generateRota`.
 */
export interface AssignmentStrategy {
  readonly id: AssignmentStrategyId;
  /**
   * Devuelve, por cada día (mismo índice), los médicos elegidos: primero las guardias
   * y después los refuerzos (`refuerzosByDay`).
   * Lanza `InfeasiblePoolError` si algún día no tiene suficientes médicos distintos.
   */
  assign(input: StrategyInput): DoctorInput[][];
}

/** Plazas de guardia y de refuerzo de un día. */
export function splitSlots(
  input: StrategyInput,
  dayIndex: number,
): { guardia: number; refuerzo: number } {
  const required = input.requiredByDay[dayIndex];
  const refuerzo = Math.min(input.refuerzosByDay?.[dayIndex] ?? 0, required);
  return { guardia: required - refuerzo, refuerzo };
}
