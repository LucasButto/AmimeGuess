/** Cada categoría se llena y deja una pausa antes de sumar la siguiente. */
export const RESULT_STEP_MS = 750;
export const RESULT_FILL_MS = 600;
export function resultFrame(elapsed: number, values: readonly number[]) {
  const shown = values.map((value, index) => Math.round(value * Math.min(1, Math.max(0, (elapsed - index * RESULT_STEP_MS) / RESULT_FILL_MS))));
  return {
    values: shown,
    total: shown.reduce((sum, value) => sum + value, 0),
    active: Math.min(values.length - 1, Math.floor(elapsed / RESULT_STEP_MS)),
    done: elapsed >= Math.max(0, values.length - 1) * RESULT_STEP_MS + RESULT_FILL_MS,
  };
}
