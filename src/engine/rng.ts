/** Generador pseudoaleatorio: cada llamada devuelve un número en [0, 1). */
export type Rng = () => number;

/** mulberry32: PRNG de 32 bits. La misma semilla produce siempre la misma secuencia. */
export function mulberry32(seed: number): Rng {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Entero en [min, max): incluye `min` y excluye `max`. */
export function randomInt(rng: Rng, min: number, max: number): number {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max <= min) {
    throw new RangeError(`Rango inválido: [${min}, ${max})`);
  }
  return min + Math.floor(rng() * (max - min));
}

/** Copia mezclada de `items` (Fisher-Yates). No modifica el original. */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(rng, 0, i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** `n` elementos distintos de `items`, en orden aleatorio. No modifica el original. */
export function pickN<T>(rng: Rng, items: readonly T[], n: number): T[] {
  if (!Number.isInteger(n) || n < 0 || n > items.length) {
    throw new RangeError(`No se pueden elegir ${n} de ${items.length} elementos`);
  }
  const pool = items.slice();
  for (let i = 0; i < n; i++) {
    const j = randomInt(rng, i, pool.length);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}
