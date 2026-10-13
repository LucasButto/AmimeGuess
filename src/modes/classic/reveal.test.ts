import { describe, expect, it } from 'vitest';
import { MAX_REVEAL_MS, REDUCED_REVEAL_MS, parseCssTime, reducedRevealTiming, revealTiming } from './reveal';

const strictlyIncreasing = (values: readonly number[]) => values.every((value, index) => index === 0 || value > values[index - 1]);

describe('revealTiming', () => {
  it.each([1, 5, 8, 12])('con %i columnas: un retraso por columna, crecientes, y la revelación completa en 2,4 s o menos', (columns) => {
    const timing = revealTiming(columns, 450, 280);
    expect(timing.delays).toHaveLength(columns);
    expect(timing.delays[0]).toBe(0);
    expect(strictlyIncreasing(timing.delays)).toBe(true);
    expect(timing.total).toBeLessThanOrEqual(MAX_REVEAL_MS);
    expect(timing.total).toBe(timing.delays[columns - 1] + timing.duration);
  });

  it('con pocas columnas usa el desfase del tema tal cual', () => {
    expect(revealTiming(5, 450, 280)).toEqual({ delays: [0, 280, 560, 840, 1120], duration: 450, total: 1570 });
  });

  it('con muchas columnas achica el desfase para no pasar el tope', () => {
    const timing = revealTiming(12, 450, 280);
    expect(timing.delays[1]).toBeLessThan(280);
    expect(timing.total).toBeLessThanOrEqual(MAX_REVEAL_MS);
    expect(timing.total).toBeGreaterThan(MAX_REVEAL_MS - 20);
  });

  it('aunque el tema pida una duración más larga que el tope, sigue sin pasarlo', () => {
    const timing = revealTiming(8, 5000, 1000);
    expect(strictlyIncreasing(timing.delays)).toBe(true);
    expect(timing.total).toBeLessThanOrEqual(MAX_REVEAL_MS);
  });

  it('sin columnas no hay nada que revelar', () => {
    expect(revealTiming(0, 450, 280)).toEqual({ delays: [], duration: 450, total: 0 });
  });
});

describe('reducedRevealTiming', () => {
  it('todas las celdas a la vez, con un fundido corto (la fila completa en 200 ms o menos)', () => {
    const timing = reducedRevealTiming(8);
    expect(new Set(timing.delays)).toEqual(new Set([0]));
    expect(timing.total).toBe(REDUCED_REVEAL_MS);
    expect(timing.total).toBeLessThanOrEqual(200);
  });
});

describe('parseCssTime', () => {
  it('entiende milisegundos y segundos', () => {
    expect(parseCssTime('450ms', 0)).toBe(450);
    expect(parseCssTime(' 0.28s ', 0)).toBe(280);
  });

  it('usa el valor de respaldo si no entiende el texto', () => {
    expect(parseCssTime('', 450)).toBe(450);
    expect(parseCssTime('rápido', 280)).toBe(280);
    expect(parseCssTime('-1s', 280)).toBe(280);
  });
});
