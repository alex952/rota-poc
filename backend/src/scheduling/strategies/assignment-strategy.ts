import { DayInfo, DoctorInput } from '../scheduling.types';

export const ASSIGNMENT_STRATEGY_IDS = ['balanced', 'wheels'] as const;
export type AssignmentStrategyId = (typeof ASSIGNMENT_STRATEGY_IDS)[number];
export const DEFAULT_ASSIGNMENT_STRATEGY: AssignmentStrategyId = 'balanced';

export interface StrategyInput {
  pool: DoctorInput[];
  // Días del año en orden cronológico, ya con las duraciones efectivas (AP incluido).
  days: DayInfo[];
  // Médicos requeridos por día (mismo índice que `days`).
  requiredByDay: number[];
}

/**
 * Método de selección de médicos. Sólo decide quién hace cada guardia: duraciones,
 * viabilidad, estadísticas y avisos son comunes y viven en `generateRota`.
 */
export interface AssignmentStrategy {
  readonly id: AssignmentStrategyId;
  /**
   * Devuelve, por cada día (mismo índice), los médicos elegidos.
   * Lanza `InfeasiblePoolError` si algún día no tiene suficientes médicos distintos.
   */
  assign(input: StrategyInput): DoctorInput[][];
}
