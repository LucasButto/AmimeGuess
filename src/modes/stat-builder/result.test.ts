import { describe, expect, it } from 'vitest';
import { resultFrame, RESULT_FILL_MS, RESULT_STEP_MS } from './result';

describe('revelación progresiva del resultado', () => {
  const values = [55, 100, 80, 65, 90, 75];
  it('empieza en cero y suma PS antes de comenzar Ataque', () => {
    expect(resultFrame(0, values).total).toBe(0);
    expect(resultFrame(RESULT_FILL_MS, values).values).toEqual([55, 0, 0, 0, 0, 0]);
    expect(resultFrame(RESULT_STEP_MS, values).total).toBe(55);
    expect(resultFrame(RESULT_STEP_MS + RESULT_FILL_MS / 2, values).total).toBe(105);
    expect(resultFrame(RESULT_STEP_MS + RESULT_FILL_MS, values).total).toBe(155);
  });
  it('solo termina cuando Velocidad llega a su valor final', () => {
    const end = 5 * RESULT_STEP_MS + RESULT_FILL_MS;
    expect(resultFrame(end - 1, values).done).toBe(false);
    expect(resultFrame(end, values)).toMatchObject({ values, total: 465, active: 5, done: true });
  });
  it('permite mostrar el resultado directamente con movimiento reducido o al restaurarlo', () => {
    expect(resultFrame(Infinity, values)).toMatchObject({ values, total: 465, done: true });
  });
});
