import { AssignmentStrategy, StrategyInput } from "./assignment-strategy";
import { assignWithWheels, staggeredInitialPointers } from "./wheels.strategy";

/**
 * Rueda única: las guardias recorren el grupo en una sola rueda, en el orden de la
 * lista, todos los días del año sin distinguir laborable, sábado, domingo, festivo ni
 * festivo especial. Los refuerzos se reparten con las cuatro ruedas por tipo de día de
 * la estrategia de ruedas (punteros escalonados y desplazados ⌊N/2⌋).
 *
 * El resto de la mecánica es la de `assignWithWheels`: «saltar y conservar turno» con
 * deuda contada cuando alguien no está descansado, y descanso blando como último recurso.
 */
export const singleWheelStrategy: AssignmentStrategy = {
  id: "single-wheel",

  assign(input: StrategyInput) {
    return assignWithWheels(input, staggeredInitialPointers(input.pool.length), {
      singleGuardiaWheel: true,
    });
  },
};
