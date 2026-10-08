import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { DailyContext } from '@/engine/daily';
import type { Entity } from '@/engine/types';
import {
  GRID_ROW,
  MAX_ROUNDS,
  buildRounds,
  formatValue,
  metricOfDay,
  poolOf,
  progressOf,
  restorePicks,
  shareGrid,
  valueOf,
  winnerOf,
  type Round,
} from './logic';
import type { HigherLowerMetric } from './types';

const METRICS: HigherLowerMetric[] = [
  { key: 'peso', label: 'Peso', question: '¿Cuál pesa más?', unit: 'kg' },
  { key: 'altura', label: 'Altura', question: '¿Cuál es más alto?', unit: 'm' },
  { key: 'total', label: 'Total', question: '¿Cuál tiene más?' },
];

const entity = (id: string, series: string[], attrs: Entity['attrs']): Entity => ({
  id,
  name: { es: id },
  aliases: [],
  series,
  image: `test/${id}`,
  attrs,
});

/** 40 entidades con valores todos distintos: peso 1, 4, 7… */
const POOL = Array.from({ length: 40 }, (_, i) =>
  entity(`p${String(i).padStart(2, '0')}`, ['g1'], { peso: i * 3 + 1, altura: i + 0.5, total: 100 + i }),
);
const ctx: DailyContext = { franchise: 'test', mode: 'mayor-o-menor', filterKey: 'all', day: 100 };

describe('metricOfDay', () => {
  it('alterna las métricas en orden, una por día', () => {
    expect([0, 1, 2, 3, 4, 5].map((day) => metricOfDay(METRICS, day).key)).toEqual([
      'peso',
      'altura',
      'total',
      'peso',
      'altura',
      'total',
    ]);
  });

  it('es la misma para todos los filtros de un día y no depende del reloj', () => {
    expect(metricOfDay(METRICS, 279)).toBe(metricOfDay(METRICS, 279));
    expect(metricOfDay(METRICS, 279).key).toBe('peso');
  });

  it('con un día negativo sigue dentro del rango', () => {
    expect(metricOfDay(METRICS, -1).key).toBe('total');
    expect(metricOfDay(METRICS, -3).key).toBe('peso');
  });

  it('con una sola métrica, siempre esa', () => {
    expect(metricOfDay([METRICS[0]], 7).key).toBe('peso');
  });

  it('sin métricas es un error de configuración', () => {
    expect(() => metricOfDay([], 1)).toThrow(RangeError);
  });
});

describe('valueOf', () => {
  const e = entity('x', ['g1'], { peso: 6.9, texto: '12', nada: null, lista: ['1'], nan: Number.NaN });

  it('lee un atributo numérico', () => {
    expect(valueOf(e, 'peso')).toBe(6.9);
  });

  it('lo que no es un número es "sin valor"', () => {
    for (const key of ['texto', 'nada', 'lista', 'nan', 'no-existe']) expect(valueOf(e, key), key).toBeNull();
  });
});

describe('poolOf', () => {
  const entities = [
    entity('b', ['g1'], { peso: 2, altura: 1, total: 10 }),
    entity('a', ['g1'], { peso: 1, altura: 2, total: 20 }),
    entity('c', ['g2'], { peso: 3, altura: 3, total: 30 }),
    entity('d', ['g1'], { peso: 4, altura: null, total: 40 }),
    entity('e', ['g1', 'g3'], { peso: 5, altura: 5, total: 50 }),
  ];

  it('deja las entidades elegibles con valor en todas las métricas, ordenadas por id', () => {
    expect(poolOf(entities, ['g1'], METRICS).map((e) => e.id)).toEqual(['a', 'b', 'e']);
  });

  it('con una serie apagada no aparece nada de ella (regla 1)', () => {
    expect(poolOf(entities, ['g2'], METRICS).map((e) => e.id)).toEqual(['c']);
    expect(poolOf(entities, ['g3'], METRICS).map((e) => e.id)).toEqual(['e']);
  });

  it('el orden de los datos no cambia el resultado', () => {
    expect(poolOf([...entities].reverse(), ['g1', 'g2'], METRICS)).toEqual(poolOf(entities, ['g1', 'g2'], METRICS));
  });

  it('no modifica los datos de entrada', () => {
    const copy = [...entities];
    poolOf(entities, ['g1'], METRICS);
    expect(entities).toEqual(copy);
  });
});

describe('buildRounds', () => {
  it('es determinista: mismos filtros y día, misma secuencia', () => {
    const first = buildRounds(POOL, 'peso', ctx).map((r) => [r.a.id, r.b.id]);
    for (let i = 0; i < 200; i++) {
      expect(buildRounds(POOL, 'peso', { ...ctx }).map((r) => [r.a.id, r.b.id])).toEqual(first);
    }
  });

  it('vector fijo: un cambio en el PRNG o en la semilla cambiaría el reto de todos', () => {
    const rounds = buildRounds(POOL, 'peso', { franchise: 'pokemon', mode: 'mayor-o-menor', filterKey: 'all', day: 0 }, 5);
    expect(rounds.map((r) => `${r.a.id}-${r.b.id}`)).toEqual(['p05-p08', 'p06-p39', 'p24-p13', 'p24-p04', 'p36-p29']);
  });

  it('una secuencia completa tiene MAX_ROUNDS pares', () => {
    expect(buildRounds(POOL, 'peso', ctx)).toHaveLength(MAX_ROUNDS);
    expect(buildRounds(POOL, 'peso', ctx, 7)).toHaveLength(7);
  });

  it('cambia con los filtros y con el día', () => {
    const ids = (c: DailyContext) => buildRounds(POOL, 'peso', c).map((r) => `${r.a.id}-${r.b.id}`).join();
    expect(ids({ ...ctx, filterKey: 'g1' })).not.toBe(ids(ctx));
    expect(ids({ ...ctx, day: 101 })).not.toBe(ids(ctx));
    expect(ids({ ...ctx, mode: 'otro' })).not.toBe(ids(ctx));
  });

  it('nunca ofrece un empate como par', () => {
    const withTies = Array.from({ length: 30 }, (_, i) => entity(`t${String(i).padStart(2, '0')}`, ['g1'], { v: i % 5 }));
    for (let day = 0; day < 100; day++) {
      for (const round of buildRounds(withTies, 'v', { ...ctx, day })) {
        expect(round.aValue).not.toBe(round.bValue);
      }
    }
  });

  it('un par nunca se repite en la partida, ni invertido', () => {
    for (let day = 0; day < 100; day++) {
      const keys = buildRounds(POOL, 'peso', { ...ctx, day }).map((r) => [r.a.id, r.b.id].sort().join('|'));
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('los valores del par son los de la métrica pedida', () => {
    for (const round of buildRounds(POOL, 'altura', ctx)) {
      expect(round.aValue).toBe(valueOf(round.a, 'altura'));
      expect(round.bValue).toBe(valueOf(round.b, 'altura'));
    }
  });

  it('el mayor cae de los dos lados por igual', () => {
    let left = 0;
    let total = 0;
    for (let day = 0; day < 100; day++) {
      for (const round of buildRounds(POOL, 'peso', { ...ctx, day })) {
        total++;
        if (round.aValue > round.bValue) left++;
      }
    }
    expect(left / total).toBeGreaterThan(0.45);
    expect(left / total).toBeLessThan(0.55);
  });

  it('un pool donde todo empata no se cuelga: da una secuencia vacía', () => {
    const same = Array.from({ length: 12 }, (_, i) => entity(`s${i}`, ['g1'], { v: 5 }));
    expect(buildRounds(same, 'v', ctx)).toEqual([]);
  });

  it('con pocos pares distintos posibles, la secuencia es más corta', () => {
    const three = POOL.slice(0, 3);
    expect(buildRounds(three, 'peso', ctx)).toHaveLength(3);
  });

  it('con menos de dos entidades no hay pares', () => {
    expect(buildRounds([], 'peso', ctx)).toEqual([]);
    expect(buildRounds(POOL.slice(0, 1), 'peso', ctx)).toEqual([]);
  });
});

describe('progressOf y restorePicks', () => {
  const rounds: Round[] = [
    { a: entity('a1', ['g1'], {}), b: entity('b1', ['g1'], {}), aValue: 10, bValue: 5 }, // gana a1
    { a: entity('a2', ['g1'], {}), b: entity('b2', ['g1'], {}), aValue: 1, bValue: 9 }, // gana b2
    { a: entity('a3', ['g1'], {}), b: entity('b3', ['g1'], {}), aValue: 7, bValue: 3 }, // gana a3
  ];

  it('winnerOf es el de mayor valor', () => {
    expect(winnerOf(rounds[0]).id).toBe('a1');
    expect(winnerOf(rounds[1]).id).toBe('b2');
  });

  it('al empezar: puntaje 0 y sigue', () => {
    expect(progressOf([], rounds)).toEqual({ score: 0, ended: false, failedAt: null });
  });

  it('cada acierto suma uno', () => {
    expect(progressOf(['a1'], rounds)).toEqual({ score: 1, ended: false, failedAt: null });
    expect(progressOf(['a1', 'b2'], rounds)).toEqual({ score: 2, ended: false, failedAt: null });
  });

  it('termina al primer error y el puntaje es la racha hasta ahí', () => {
    expect(progressOf(['b1'], rounds)).toEqual({ score: 0, ended: true, failedAt: 0 });
    expect(progressOf(['a1', 'a2'], rounds)).toEqual({ score: 1, ended: true, failedAt: 1 });
  });

  it('acertar todas las rondas termina con puntaje perfecto', () => {
    expect(progressOf(['a1', 'b2', 'a3'], rounds)).toEqual({ score: 3, ended: true, failedAt: null });
  });

  it('restaura elecciones válidas', () => {
    expect(restorePicks(['a1', 'b2'], rounds)).toEqual(['a1', 'b2']);
  });

  it('corta en el primer error: no queda nada después', () => {
    expect(restorePicks(['a1', 'a2', 'a3'], rounds)).toEqual(['a1', 'a2']);
  });

  it('descarta lo que no es uno de los dos de su ronda, y todo lo que sigue', () => {
    expect(restorePicks(['a1', 'zzz', 'a3'], rounds)).toEqual(['a1']);
    expect(restorePicks(['b2'], rounds)).toEqual([]);
    expect(restorePicks([3, null], rounds)).toEqual([]);
  });

  it('no restaura más elecciones que rondas', () => {
    expect(restorePicks(['a1', 'b2', 'a3', 'a1'], rounds)).toEqual(['a1', 'b2', 'a3']);
  });

  it('sin nada guardado, nada', () => {
    expect(restorePicks(undefined, rounds)).toEqual([]);
  });
});

describe('shareGrid', () => {
  it('un cuadrado por acierto y un 🟥 por el error final', () => {
    expect(shareGrid(3, true)).toEqual(['🟩🟩🟩🟥']);
    expect(shareGrid(0, true)).toEqual(['🟥']);
  });

  it('una racha perfecta no lleva 🟥', () => {
    expect(shareGrid(4, false)).toEqual(['🟩🟩🟩🟩']);
  });

  it('parte en líneas de GRID_ROW', () => {
    expect(GRID_ROW).toBe(10);
    expect(shareGrid(25, true)).toEqual(['🟩'.repeat(10), '🟩'.repeat(10), '🟩'.repeat(5) + '🟥']);
    expect(shareGrid(10, false)).toEqual(['🟩'.repeat(10)]);
  });

  it('sin jugadas, nada', () => {
    expect(shareGrid(0, false)).toEqual([]);
  });
});

describe('formatValue', () => {
  it('con unidad y decimales a la argentina', () => {
    expect(formatValue(6.9, 'kg')).toBe('6,9 kg');
    expect(formatValue(1000, 'kg')).toBe('1.000 kg');
  });

  it('sin unidad', () => {
    expect(formatValue(318)).toBe('318');
  });

  it('redondea a dos decimales', () => {
    expect(formatValue(0.456789, 'm')).toBe('0,46 m');
  });
});

describe('src/modes/higher-lower', () => {
  const dir = fileURLToPath(new URL('.', import.meta.url));
  const code = readFileSync(`${dir}logic.ts`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('la lógica no usa azar ni reloj (regla 1 de CLAUDE.md)', () => {
    for (const pattern of [/Math\.random\b/, /Date\.now\b/, /new Date\(/, /getTimezoneOffset/, /performance\.now\b/]) {
      expect(code).not.toMatch(pattern);
    }
  });

  it('la lógica no importa React ni nada de una franquicia (regla 2)', () => {
    expect(code).not.toMatch(/from\s+['"](react|next|@\/franchises|@\/components)/);
  });
});
