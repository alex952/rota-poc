/** Fuente de aleatoriedad: devuelve un número en [0, 1), como `Math.random`. */
export type RandomSource = () => number;

/**
 * Devuelve una copia barajada de `items` (Fisher–Yates) sin modificar el original.
 * Se usa para que el orden del grupo —y por tanto quién empieza la rotación— no sea
 * siempre el mismo de un año a otro.
 */
export function shuffle<T>(items: readonly T[], random: RandomSource = Math.random): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return shuffled;
}
