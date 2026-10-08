import { describe, expect, it } from 'vitest';
import type { DailyContext } from '@/engine/daily';
import type { Content } from '@/engine/types';
import {
  attemptsOf,
  buildPuzzle,
  countOf,
  dropRank,
  isSolved,
  lockedPositions,
  marksOf,
  moveToRank,
  outcomeOf,
  poolOf,
  restoreAttempts,
  shareGrid,
  step,
  type Puzzle,
  type TimelineItem,
} from './logic';
import type { TimelineConfig } from './types';

const CONFIG: TimelineConfig = { contentKind: 'event', textField: 'text', orderField: 'order' };
const ctx: DailyContext = { franchise: 'test', mode: 'linea-de-tiempo', filterKey: 'all', day: 100 };

const event = (id: string, series: string, order: unknown, text: unknown = id, kind = 'event'): Content => ({
  id,
  kind,
  series,
  payload: { text, order },
  verified: true,
});

/** 30 sucesos de tres series, con el orden global igual a su número. */
const CONTENTS: Content[] = Array.from({ length: 30 }, (_, i) =>
  event(`e${String(i + 1).padStart(2, '0')}`, ['a', 'b', 'c'][Math.floor(i / 10)], i + 1),
);
const POOL = poolOf(CONTENTS, ['a', 'b', 'c'], CONFIG);

const item = (id: string, order: number): TimelineItem => ({ id, text: id, order });
const SOLUTION = [item('w', 1), item('x', 2), item('y', 3), item('z', 4)];
const PUZZLE: Puzzle = { solution: SOLUTION, start: ['y', 'w', 'z', 'x'] };

describe('configuración', () => {
  it('por defecto son 5 sucesos y 4 intentos', () => {
    expect(countOf(CONFIG)).toBe(5);
    expect(attemptsOf(CONFIG)).toBe(4);
    expect(countOf({ ...CONFIG, count: 6 })).toBe(6);
    expect(attemptsOf({ ...CONFIG, attempts: 3 })).toBe(3);
  });
});

describe('poolOf', () => {
  it('con todas las series, todos los sucesos, ordenados por id', () => {
    expect(POOL).toHaveLength(30);
    expect(POOL.map((entry) => entry.id)).toEqual([...POOL.map((entry) => entry.id)].sort());
  });

  it('regla 2: solo los de series activas', () => {
    expect(poolOf(CONTENTS, ['a'], CONFIG)).toHaveLength(10);
    expect(poolOf(CONTENTS, ['b', 'c'], CONFIG)).toHaveLength(20);
    expect(poolOf(CONTENTS, ['b'], CONFIG).every((entry) => entry.order > 10 && entry.order <= 20)).toBe(true);
  });

  it('con una serie inactiva no queda ningún suceso suyo', () => {
    const ids = new Set(poolOf(CONTENTS, ['a', 'c'], CONFIG).map((entry) => entry.id));
    for (const content of CONTENTS.filter((candidate) => candidate.series === 'b')) expect(ids.has(content.id)).toBe(false);
  });

  it('solo cuenta el tipo de contenido de la configuración', () => {
    const mixed = [...CONTENTS, event('q1', 'a', 5, 'frase', 'quote')];
    expect(poolOf(mixed, ['a', 'b', 'c'], CONFIG)).toHaveLength(30);
  });

  it('descarta los que no tienen texto o lugar en la cronología', () => {
    const broken = [event('ok', 'a', 1), event('sin-texto', 'a', 2, ''), event('texto-no-string', 'a', 3, 42), event('sin-orden', 'a', undefined), event('orden-texto', 'a', '3'), event('infinito', 'a', Infinity)];
    expect(poolOf(broken, ['a'], CONFIG).map((entry) => entry.id)).toEqual(['ok']);
  });

  it('lee los campos que dice la configuración', () => {
    const custom: Content = { id: 'x', kind: 'hito', series: 'a', payload: { titulo: 'Algo', lugar: 7 }, verified: true };
    expect(poolOf([custom], ['a'], { contentKind: 'hito', textField: 'titulo', orderField: 'lugar' })).toEqual([{ id: 'x', text: 'Algo', order: 7 }]);
  });
});

describe('buildPuzzle', () => {
  it('elige 5 sucesos distintos y los pone en orden cronológico', () => {
    const puzzle = buildPuzzle(POOL, ctx, 5);
    expect(puzzle).not.toBeNull();
    const orders = puzzle!.solution.map((entry) => entry.order);
    expect(new Set(puzzle!.solution.map((entry) => entry.id)).size).toBe(5);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it('el desorden tiene los mismos sucesos y nunca empieza resuelto', () => {
    for (let day = 0; day < 300; day++) {
      const puzzle = buildPuzzle(POOL, { ...ctx, day }, 5)!;
      expect([...puzzle.start].sort()).toEqual(puzzle.solution.map((entry) => entry.id).sort());
      expect(isSolved(puzzle.start, puzzle)).toBe(false);
    }
  });

  it('con pocos sucesos tampoco empieza resuelto', () => {
    const small = POOL.slice(0, 2);
    for (let day = 0; day < 200; day++) expect(isSolved(buildPuzzle(small, { ...ctx, day }, 2)!.start, buildPuzzle(small, { ...ctx, day }, 2)!)).toBe(false);
  });

  it('el mismo contexto da siempre el mismo reto', () => {
    const first = buildPuzzle(POOL, ctx, 5);
    for (let i = 0; i < 100; i++) expect(buildPuzzle(POOL, ctx, 5)).toEqual(first);
  });

  it('no depende del orden en que vienen los contenidos de los datos', () => {
    const reversed = poolOf([...CONTENTS].reverse(), ['a', 'b', 'c'], CONFIG);
    expect(buildPuzzle(reversed, ctx, 5)).toEqual(buildPuzzle(POOL, ctx, 5));
  });

  it('otra combinación de filtros o de día es otro reto en casi todos los días', () => {
    let different = 0;
    for (let day = 0; day < 100; day++) {
      const a = buildPuzzle(POOL, { ...ctx, day }, 5)!.solution.map((entry) => entry.id).join();
      const b = buildPuzzle(POOL, { ...ctx, day, filterKey: 'a.b' }, 5)!.solution.map((entry) => entry.id).join();
      if (a !== b) different++;
    }
    expect(different).toBeGreaterThan(90);
  });

  it('con tantos sucesos como el pool los usa todos', () => {
    const puzzle = buildPuzzle(POOL.slice(0, 5), ctx, 5)!;
    expect(puzzle.solution).toHaveLength(5);
  });

  it('si el pool no alcanza, no hay reto', () => {
    expect(buildPuzzle(POOL.slice(0, 4), ctx, 5)).toBeNull();
    expect(buildPuzzle([], ctx, 5)).toBeNull();
  });

  it('vectores fijos: tres días con todas las series y uno con otra combinación', () => {
    const summary = (context: DailyContext) => {
      const puzzle = buildPuzzle(POOL, context, 5)!;
      return { solution: puzzle.solution.map((entry) => entry.id), start: [...puzzle.start] };
    };
    expect(summary({ ...ctx, day: 0 })).toEqual({ solution: ['e11', 'e12', 'e16', 'e17', 'e19'], start: ['e19', 'e17', 'e12', 'e11', 'e16'] });
    expect(summary({ ...ctx, day: 1 })).toEqual({ solution: ['e15', 'e19', 'e20', 'e24', 'e26'], start: ['e20', 'e19', 'e15', 'e26', 'e24'] });
    expect(summary({ ...ctx, day: 2 })).toEqual({ solution: ['e06', 'e11', 'e18', 'e19', 'e22'], start: ['e22', 'e18', 'e06', 'e11', 'e19'] });
    expect(summary({ ...ctx, day: 0, filterKey: 'a.b' })).toEqual({ solution: ['e13', 'e15', 'e16', 'e18', 'e20'], start: ['e20', 'e15', 'e18', 'e16', 'e13'] });
  });
});

describe('evaluar un orden', () => {
  it('marca por posición si el suceso es el que le toca', () => {
    expect(marksOf(['w', 'x', 'y', 'z'], PUZZLE)).toEqual([true, true, true, true]);
    expect(marksOf(['y', 'w', 'z', 'x'], PUZZLE)).toEqual([false, false, false, false]);
    expect(marksOf(['w', 'y', 'x', 'z'], PUZZLE)).toEqual([true, false, false, true]);
  });

  it('isSolved pide todas las posiciones bien', () => {
    expect(isSolved(['w', 'x', 'y', 'z'], PUZZLE)).toBe(true);
    expect(isSolved(['w', 'x', 'z', 'y'], PUZZLE)).toBe(false);
    expect(isSolved(['w', 'x', 'y'], PUZZLE)).toBe(false);
  });

  it('dos sucesos con el mismo lugar son intercambiables', () => {
    const tie: Puzzle = { solution: [item('a', 1), item('b', 2), item('c', 2)], start: ['c', 'b', 'a'] };
    expect(isSolved(['a', 'b', 'c'], tie)).toBe(true);
    expect(isSolved(['a', 'c', 'b'], tie)).toBe(true);
    expect(isSolved(['b', 'a', 'c'], tie)).toBe(false);
  });

  it('lockedPositions junta las posiciones acertadas de todos los intentos', () => {
    expect([...lockedPositions([], PUZZLE)]).toEqual([]);
    expect([...lockedPositions([['w', 'y', 'x', 'z']], PUZZLE)].sort()).toEqual([0, 3]);
    expect([...lockedPositions([['w', 'y', 'x', 'z'], ['x', 'w', 'y', 'z']], PUZZLE)].sort()).toEqual([0, 2, 3]);
  });

  it('outcomeOf: resuelto, en juego o sin intentos', () => {
    const wrong = ['y', 'w', 'z', 'x'];
    expect(outcomeOf([], PUZZLE, 4)).toEqual({ solved: false, over: false });
    expect(outcomeOf([wrong, wrong], PUZZLE, 4)).toEqual({ solved: false, over: false });
    expect(outcomeOf([wrong, wrong, wrong, wrong], PUZZLE, 4)).toEqual({ solved: false, over: true });
    expect(outcomeOf([wrong, ['w', 'x', 'y', 'z']], PUZZLE, 4)).toEqual({ solved: true, over: true });
  });

  it('shareGrid: una línea por intento con un cuadrado por posición, sin nombres', () => {
    expect(shareGrid([['y', 'w', 'z', 'x'], ['w', 'y', 'x', 'z'], ['w', 'x', 'y', 'z']], PUZZLE)).toEqual(['🟥🟥🟥🟥', '🟩🟥🟥🟩', '🟩🟩🟩🟩']);
    expect(shareGrid([], PUZZLE)).toEqual([]);
  });
});

describe('restoreAttempts', () => {
  const good = ['y', 'w', 'z', 'x'];

  it('conserva los intentos válidos', () => {
    expect(restoreAttempts([good, ['w', 'y', 'x', 'z']], PUZZLE, 4)).toEqual([good, ['w', 'y', 'x', 'z']]);
  });

  it('sin nada guardado, no hay intentos', () => {
    expect(restoreAttempts(undefined, PUZZLE, 4)).toEqual([]);
  });

  it('corta en el primero que no es un orden de los sucesos de hoy', () => {
    expect(restoreAttempts([good, ['w', 'x'], good], PUZZLE, 4)).toEqual([good]);
    expect(restoreAttempts([good, ['w', 'x', 'y', 'otro'], good], PUZZLE, 4)).toEqual([good]);
    expect(restoreAttempts([good, ['w', 'w', 'y', 'z'], good], PUZZLE, 4)).toEqual([good]);
    expect(restoreAttempts([good, 'no es una lista', good], PUZZLE, 4)).toEqual([good]);
    expect(restoreAttempts([good, [1, 2, 3, 4], good], PUZZLE, 4)).toEqual([good]);
  });

  it('no pasa de los intentos permitidos ni sigue después de resolver', () => {
    expect(restoreAttempts([good, good, good, good, good], PUZZLE, 4)).toHaveLength(4);
    expect(restoreAttempts([good, ['w', 'x', 'y', 'z'], good], PUZZLE, 4)).toEqual([good, ['w', 'x', 'y', 'z']]);
  });

  it('devuelve copias: modificar el resultado no toca lo guardado', () => {
    const stored = [['y', 'w', 'z', 'x']];
    restoreAttempts(stored, PUZZLE, 4)[0].push('basura');
    expect(stored[0]).toEqual(['y', 'w', 'z', 'x']);
  });
});

describe('mover', () => {
  const none = new Set<number>();
  const order = ['a', 'b', 'c', 'd', 'e'];

  it('moveToRank mueve un suceso y corre los demás', () => {
    expect(moveToRank(order, none, 'a', 2)).toEqual(['b', 'c', 'a', 'd', 'e']);
    expect(moveToRank(order, none, 'e', 0)).toEqual(['e', 'a', 'b', 'c', 'd']);
    expect(moveToRank(order, none, 'c', 2)).toEqual(order);
  });

  it('un lugar fuera de rango se lleva al extremo', () => {
    expect(moveToRank(order, none, 'b', 99)).toEqual(['a', 'c', 'd', 'e', 'b']);
    expect(moveToRank(order, none, 'd', -5)).toEqual(['d', 'a', 'b', 'c', 'e']);
  });

  it('no modifica el orden original y devuelve null si el suceso no está', () => {
    const copy = [...order];
    moveToRank(copy, none, 'a', 3);
    expect(copy).toEqual(order);
    expect(moveToRank(order, none, 'zzz', 1)).toBeNull();
  });

  it('los sucesos fijos no se mueven ni se pueden mover', () => {
    const locked = new Set([1, 3]);
    // Los que se mueven son a, c, e (posiciones 0, 2 y 4); b y d quedan donde están.
    expect(moveToRank(order, locked, 'a', 2)).toEqual(['c', 'b', 'e', 'd', 'a']);
    expect(moveToRank(order, locked, 'e', 0)).toEqual(['e', 'b', 'a', 'd', 'c']);
    expect(moveToRank(order, locked, 'b', 0)).toBeNull();
  });

  it('step sube y baja un lugar y dice dónde queda', () => {
    expect(step(order, none, 2, -1)).toEqual({ arrangement: ['a', 'c', 'b', 'd', 'e'], index: 1 });
    expect(step(order, none, 2, 1)).toEqual({ arrangement: ['a', 'b', 'd', 'c', 'e'], index: 3 });
  });

  it('step no pasa de los extremos', () => {
    expect(step(order, none, 0, -1)).toBeNull();
    expect(step(order, none, 4, 1)).toBeNull();
  });

  it('step salta los sucesos fijos', () => {
    const locked = new Set([1]);
    // c (posición 2) sube y se salta a b (fijo): intercambia con a.
    expect(step(order, locked, 2, -1)).toEqual({ arrangement: ['c', 'b', 'a', 'd', 'e'], index: 0 });
    expect(step(order, locked, 0, 1)).toEqual({ arrangement: ['c', 'b', 'a', 'd', 'e'], index: 2 });
    expect(step(order, locked, 1, 1)).toBeNull();
  });

  it('un orden resuelto a base de pasos llega a la solución', () => {
    let current = [...PUZZLE.start];
    // Ordenamiento por inserción usando solo `step`.
    for (let target = 0; target < PUZZLE.solution.length; target++) {
      let index = current.indexOf(PUZZLE.solution[target].id);
      while (index > target) {
        const next = step(current, none, index, -1)!;
        current = next.arrangement;
        index = next.index;
      }
    }
    expect(isSolved(current, PUZZLE)).toBe(true);
  });
});

describe('dropRank', () => {
  it('cuenta cuántos de los demás quedan por encima del centro del arrastrado', () => {
    const centers = [10, 30, 50, 70];
    expect(dropRank(centers, 5)).toBe(0);
    expect(dropRank(centers, 31)).toBe(2);
    expect(dropRank(centers, 100)).toBe(4);
  });

  it('con alturas distintas sigue los centros reales', () => {
    expect(dropRank([20, 90, 130], 95)).toBe(2);
  });
});
