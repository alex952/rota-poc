import { AssignmentStrategy, AssignmentStrategyId } from './assignment-strategy';
import { singleWheelStrategy } from './single-wheel.strategy';
import { wheelsStrategy } from './wheels.strategy';

export * from './assignment-strategy';

export const ASSIGNMENT_STRATEGIES: Record<AssignmentStrategyId, AssignmentStrategy> = {
  wheels: wheelsStrategy,
  'single-wheel': singleWheelStrategy,
};

export function getAssignmentStrategy(id: AssignmentStrategyId): AssignmentStrategy {
  const strategy = ASSIGNMENT_STRATEGIES[id];
  if (!strategy) {
    throw new Error(`Método de asignación desconocido: ${id}`);
  }
  return strategy;
}
