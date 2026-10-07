import { describe, expect, it } from 'vitest';
import { mulberry32, pickN, randomInt, shuffle } from './rng';

function take(count: number, seed: number): number[] {
  const rng = mulberry32(seed);
  return Array.from({ length: count }, () => rng());
}

describe('mulberry32', () => {
  it('vectores fijos: las primeras cinco salidas de cada semilla', () => {
    expect(take(5, 0)).toEqual([
      0.26642920868471265, 0.0003297457005828619, 0.2232720274478197, 0.1462021479383111,
      0.46732782293111086,
    ]);
    expect(take(5, 1)).toEqual([
      0.6270739405881613, 0.002735721180215478, 0.5274470399599522, 0.9810509674716741,
      0.9683778982143849,
    ]);
    expect(take(5, 12345)).toEqual([
      0.9797282677609473, 0.3067522644996643, 0.484205421525985, 0.817934412509203,
      0.5094283693470061,
    ]);
    expect(take(5, 4294967295)).toEqual([
      0.8964226141106337, 0.189478256739676, 0.7156526781618595, 0.9440599093213677,
      0.8452364315744489,
    ]);
  });

  it('la misma semilla repite la secuencia y otra semilla la cambia', () => {
    expect(take(50, 777)).toEqual(take(50, 777));
    expect(take(50, 777)).not.toEqual(take(50, 778));
  });

  it('devuelve números en [0, 1)', () => {
    for (const value of take(10_000, 42)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('randomInt', () => {
  it('incluye el mínimo, excluye el máximo y cubre todo el rango', () => {
    const rng = mulberry32(5);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) seen.add(randomInt(rng, 3, 8));
    expect([...seen].sort()).toEqual([3, 4, 5, 6, 7]);
  });

  it('acepta rangos con negativos', () => {
    const rng = mulberry32(9);
    for (let i = 0; i < 500; i++) {
      const value = randomInt(rng, -2, 2);
      expect(value).toBeGreaterThanOrEqual(-2);
      expect(value).toBeLessThan(2);
    }
  });

  it('rechaza rangos vacíos o no enteros', () => {
    const rng = mulberry32(1);
    expect(() => randomInt(rng, 5, 5)).toThrow(RangeError);
    expect(() => randomInt(rng, 5, 2)).toThrow(RangeError);
    expect(() => randomInt(rng, 0.5, 3)).toThrow(RangeError);
  });
});

describe('shuffle', () => {
  const items = Array.from({ length: 20 }, (_, i) => i);

  it('devuelve una permutación sin modificar el original', () => {
    const original = [...items];
    const result = shuffle(mulberry32(3), items);
    expect(items).toEqual(original);
    expect([...result].sort((a, b) => a - b)).toEqual(items);
  });

  it('es determinista con la misma semilla y distinto con otra', () => {
    expect(shuffle(mulberry32(3), items)).toEqual(shuffle(mulberry32(3), items));
    expect(shuffle(mulberry32(3), items)).not.toEqual(shuffle(mulberry32(4), items));
  });

  it('acepta listas vacías y de un elemento', () => {
    expect(shuffle(mulberry32(1), [])).toEqual([]);
    expect(shuffle(mulberry32(1), ['solo'])).toEqual(['solo']);
  });
});

describe('pickN', () => {
  const items = Array.from({ length: 30 }, (_, i) => `item-${i}`);

  it('elige n elementos distintos del conjunto', () => {
    const picked = pickN(mulberry32(8), items, 5);
    expect(picked).toHaveLength(5);
    expect(new Set(picked).size).toBe(5);
    for (const item of picked) expect(items).toContain(item);
  });

  it('es determinista y no modifica el original', () => {
    const original = [...items];
    expect(pickN(mulberry32(8), items, 5)).toEqual(pickN(mulberry32(8), items, 5));
    expect(items).toEqual(original);
  });

  it('permite elegir 0 y todos los elementos', () => {
    expect(pickN(mulberry32(1), items, 0)).toEqual([]);
    expect([...pickN(mulberry32(1), items, 30)].sort()).toEqual([...items].sort());
  });

  it('rechaza pedir más de los que hay o una cantidad inválida', () => {
    expect(() => pickN(mulberry32(1), items, 31)).toThrow(RangeError);
    expect(() => pickN(mulberry32(1), items, -1)).toThrow(RangeError);
    expect(() => pickN(mulberry32(1), items, 2.5)).toThrow(RangeError);
  });
});
