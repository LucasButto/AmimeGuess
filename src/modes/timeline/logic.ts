// Lógica pura del motor `timeline`. Sin React y sin nada de ninguna franquicia:
// recibe la configuración y los contenidos por parámetro. Los sucesos de un día
// salen de `seedFor(ctx)` sobre el pool ordenado por id (SPEC 5, "Modos de
// secuencia"): nunca de azar ni de un reloj, así dos personas con los mismos
// filtros ordenan exactamente los mismos sucesos y los ven en el mismo desorden.

import { seedFor, type DailyContext } from '@/engine/daily';
import { eligibleContents } from '@/engine/filters';
import { mulberry32, pickN, shuffle } from '@/engine/rng';
import type { Content } from '@/engine/types';
import { DEFAULT_ATTEMPTS, DEFAULT_COUNT, type TimelineConfig } from './types';

export const countOf = (config: TimelineConfig): number => config.count ?? DEFAULT_COUNT;
export const attemptsOf = (config: TimelineConfig): number => config.attempts ?? DEFAULT_ATTEMPTS;

// --- Pool ---------------------------------------------------------------------

/** Un suceso a ordenar. */
export interface TimelineItem {
  readonly id: string;
  readonly text: string;
  /** Lugar en la cronología: el menor ocurre antes. */
  readonly order: number;
}

function byId(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Los sucesos que pueden salir con las series activas: contenidos elegibles
 * (regla 2) del tipo de la configuración que tienen un texto y un lugar en la
 * cronología. Ordenados por id: de ese orden depende la elección, así que no puede
 * depender del de los datos.
 */
export function poolOf(contents: readonly Content[], active: readonly string[], config: TimelineConfig): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const content of eligibleContents(contents, active)) {
    if (content.kind !== config.contentKind) continue;
    const text = content.payload[config.textField];
    const order = content.payload[config.orderField];
    if (typeof text !== 'string' || text.length === 0) continue;
    if (typeof order !== 'number' || !Number.isFinite(order)) continue;
    items.push({ id: content.id, text, order });
  }
  return items.sort(byId);
}

// --- El reto de un día -----------------------------------------------------------

export interface Puzzle {
  /** Los sucesos del día en su orden cronológico: la solución. */
  readonly solution: readonly TimelineItem[];
  /** Los mismos, como se ven al empezar: nunca ya en orden. */
  readonly start: readonly string[];
}

function byOrder(a: TimelineItem, b: TimelineItem): number {
  return a.order - b.order || byId(a, b);
}

function sameSequence(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

/**
 * El reto del día: `count` sucesos distintos elegidos del pool con el PRNG del día,
 * y el desorden con el que arrancan. `null` si el pool no alcanza para tantos.
 * El desorden nunca coincide con la solución (no empieza resuelto).
 */
export function buildPuzzle(pool: readonly TimelineItem[], ctx: DailyContext, count: number): Puzzle | null {
  if (count < 2 || pool.length < count) return null;
  const rng = mulberry32(seedFor(ctx));
  const solution = pickN(rng, pool, count).sort(byOrder);
  const ids = solution.map((item) => item.id);

  let start = shuffle(rng, ids);
  // Con 2 o 3 sucesos puede salir justo la solución: se vuelve a mezclar, y si aun así no, se rota.
  for (let tries = 0; tries < 20 && sameSequence(start, ids); tries++) start = shuffle(rng, ids);
  if (sameSequence(start, ids)) start = [...ids.slice(1), ids[0]];
  return { solution, start };
}

// --- Evaluar un orden ------------------------------------------------------------

/**
 * Por posición, si el suceso que está ahí es el que le toca. Se compara por lugar en la
 * cronología y no por id: dos sucesos con el mismo lugar son intercambiables.
 */
export function marksOf(arrangement: readonly string[], puzzle: Puzzle): boolean[] {
  const orderById = new Map(puzzle.solution.map((item) => [item.id, item.order]));
  return arrangement.map((id, index) => orderById.get(id) === puzzle.solution[index]?.order);
}

export function isSolved(arrangement: readonly string[], puzzle: Puzzle): boolean {
  return arrangement.length === puzzle.solution.length && marksOf(arrangement, puzzle).every(Boolean);
}

/** Las posiciones que ya acertaron en algún intento: quedan fijas, el resto se sigue moviendo. */
export function lockedPositions(attempts: readonly (readonly string[])[], puzzle: Puzzle): Set<number> {
  const locked = new Set<number>();
  for (const attempt of attempts) {
    marksOf(attempt, puzzle).forEach((correct, index) => {
      if (correct) locked.add(index);
    });
  }
  return locked;
}

export interface Outcome {
  readonly solved: boolean;
  /** Ya no se puede seguir: se resolvió o se gastaron los intentos. */
  readonly over: boolean;
}

export function outcomeOf(attempts: readonly (readonly string[])[], puzzle: Puzzle, maxAttempts: number): Outcome {
  const solved = attempts.some((attempt) => isSolved(attempt, puzzle));
  return { solved, over: solved || attempts.length >= maxAttempts };
}

/**
 * Los intentos guardados que siguen siendo válidos: cada uno tiene que ser un orden de
 * exactamente los sucesos de hoy (el dataset pudo cambiar), y no hay nada después de
 * resolverlo ni más de `maxAttempts`. Se queda con la parte válida desde el principio.
 */
export function restoreAttempts(stored: readonly unknown[] | undefined, puzzle: Puzzle, maxAttempts: number): string[][] {
  const expected = new Set(puzzle.start);
  const restored: string[][] = [];
  for (const attempt of stored ?? []) {
    if (restored.length >= maxAttempts) break;
    if (!Array.isArray(attempt) || attempt.length !== expected.size) break;
    if (!attempt.every((id): id is string => typeof id === 'string') || new Set(attempt).size !== expected.size) break;
    if (!attempt.every((id) => expected.has(id))) break;
    restored.push([...attempt]);
    if (isSolved(attempt, puzzle)) break;
  }
  return restored;
}

/**
 * Grilla para compartir: una línea por intento, en orden, con un cuadrado por posición
 * (🟩 acertó, 🟥 no). Solo colores: no dice cuáles eran los sucesos ni su orden.
 */
export function shareGrid(attempts: readonly (readonly string[])[], puzzle: Puzzle): string[] {
  return attempts.map((attempt) => marksOf(attempt, puzzle).map((correct) => (correct ? '🟩' : '🟥')).join(''));
}

// --- Mover ----------------------------------------------------------------------

/** Las posiciones que se pueden mover (las que no están fijas), en orden. */
function freePositions(length: number, locked: ReadonlySet<number>): number[] {
  return Array.from({ length }, (_, index) => index).filter((index) => !locked.has(index));
}

/**
 * Mueve el suceso `id` hasta el lugar `rank` entre los que se pueden mover, y los demás se
 * corren. Los fijos no se mueven nunca. Devuelve el orden nuevo, o `null` si `id` está fijo
 * o no está.
 */
export function moveToRank(arrangement: readonly string[], locked: ReadonlySet<number>, id: string, rank: number): string[] | null {
  const free = freePositions(arrangement.length, locked);
  const ids = free.map((position) => arrangement[position]);
  const from = ids.indexOf(id);
  if (from === -1) return null;
  const to = Math.min(Math.max(rank, 0), ids.length - 1);
  if (to === from) return [...arrangement];
  ids.splice(to, 0, ...ids.splice(from, 1));
  const next = [...arrangement];
  free.forEach((position, index) => {
    next[position] = ids[index];
  });
  return next;
}

/**
 * Sube (-1) o baja (1) un suceso un lugar entre los que se pueden mover. `null` si ya está
 * en el extremo o está fijo. Devuelve también su posición nueva.
 */
export function step(
  arrangement: readonly string[],
  locked: ReadonlySet<number>,
  index: number,
  direction: -1 | 1,
): { arrangement: string[]; index: number } | null {
  const free = freePositions(arrangement.length, locked);
  const rank = free.indexOf(index);
  const neighbour = free[rank + direction];
  if (rank === -1 || neighbour === undefined) return null;
  const moved = moveToRank(arrangement, locked, arrangement[index], rank + direction);
  return moved === null ? null : { arrangement: moved, index: neighbour };
}

/** ¿Dónde queda un suceso arrastrado? El lugar entre los que se pueden mover según dónde esté su centro respecto de los de los demás. */
export function dropRank(otherCenters: readonly number[], draggedCenter: number): number {
  return otherCenters.filter((center) => center < draggedCenter).length;
}
