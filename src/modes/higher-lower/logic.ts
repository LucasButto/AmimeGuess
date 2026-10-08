// Lógica pura del motor `higher-lower`. Sin React y sin nada de ninguna
// franquicia: recibe la configuración y las entidades por parámetro. La
// secuencia de pares de un día sale de `seedFor(ctx)` sobre el pool ordenado por
// id (SPEC 5, "Modos de secuencia"): nunca de azar ni de un reloj, así dos
// personas con los mismos filtros juegan exactamente los mismos pares.

import { seedFor, type DailyContext } from '@/engine/daily';
import { eligibleEntities } from '@/engine/filters';
import { mulberry32, randomInt } from '@/engine/rng';
import type { Entity } from '@/engine/types';
import type { HigherLowerMetric } from './types';

/** Rondas de una partida: quien las acierta todas termina con puntaje perfecto. */
export const MAX_ROUNDS = 30;

// --- Métrica y pool -----------------------------------------------------------

/** La métrica del día: se alternan en orden, una por día. */
export function metricOfDay(metrics: readonly HigherLowerMetric[], day: number): HigherLowerMetric {
  if (metrics.length === 0) throw new RangeError('No hay métricas configuradas');
  return metrics[((day % metrics.length) + metrics.length) % metrics.length];
}

/** El valor numérico de un atributo, o `null` si no tiene o no es un número. */
export function valueOf(entity: Entity, key: string): number | null {
  const value = entity.attrs[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Las entidades que pueden salir en un par con las series activas: elegibles
 * (regla 1) y con valor numérico en todas las métricas. Ordenadas por id: de
 * ese orden depende la secuencia, así que no puede depender del de los datos.
 */
export function poolOf(
  entities: readonly Entity[],
  active: readonly string[],
  metrics: readonly HigherLowerMetric[],
): Entity[] {
  return eligibleEntities(entities, active)
    .filter((entity) => metrics.every((metric) => valueOf(entity, metric.key) !== null))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

// --- Secuencia ----------------------------------------------------------------

/** Un par: hay que elegir cuál de los dos tiene el valor mayor. Nunca empatan. */
export interface Round {
  readonly a: Entity;
  readonly b: Entity;
  readonly aValue: number;
  readonly bValue: number;
}

/** El lado con el valor mayor. */
export function winnerOf(round: Round): Entity {
  return round.aValue > round.bValue ? round.a : round.b;
}

/**
 * La secuencia de pares del día. Cada par sale de dos sorteos con el PRNG del
 * día; se descartan los empates (no se ofrecen como par) y los pares ya usados
 * en esta partida, aunque una misma entidad puede volver a salir con otra.
 * Si el pool no da para tantos pares distintos, la secuencia es más corta.
 */
export function buildRounds(
  pool: readonly Entity[],
  metricKey: string,
  ctx: DailyContext,
  length: number = MAX_ROUNDS,
): Round[] {
  const count = pool.length;
  if (count < 2) return [];

  const rng = mulberry32(seedFor(ctx));
  const used = new Set<string>();
  const rounds: Round[] = [];
  // Tope de sorteos: con un pool casi todo empatado no se puede quedar dando vueltas.
  for (let draws = 0; rounds.length < length && draws < length * 100; draws++) {
    const i = randomInt(rng, 0, count);
    let j = randomInt(rng, 0, count - 1);
    if (j >= i) j++;

    const a = pool[i];
    const b = pool[j];
    const aValue = valueOf(a, metricKey);
    const bValue = valueOf(b, metricKey);
    if (aValue === null || bValue === null || aValue === bValue) continue;

    const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
    if (used.has(key)) continue;
    used.add(key);
    rounds.push({ a, b, aValue, bValue });
  }
  return rounds;
}

// --- Partida ------------------------------------------------------------------

/** Cómo va una partida con las elecciones hechas (el id de la entidad elegida en cada ronda). */
export interface Progress {
  /** Aciertos seguidos. */
  readonly score: number;
  /** Ya no se puede seguir: se falló o se acertaron todas las rondas. */
  readonly ended: boolean;
  /** Índice de la ronda en la que se falló, si se falló. */
  readonly failedAt: number | null;
}

export function progressOf(picks: readonly string[], rounds: readonly Round[]): Progress {
  let score = 0;
  for (let index = 0; index < picks.length && index < rounds.length; index++) {
    if (picks[index] !== winnerOf(rounds[index]).id) return { score, ended: true, failedAt: index };
    score++;
  }
  return { score, ended: score >= rounds.length, failedAt: null };
}

/**
 * Las elecciones guardadas que siguen siendo válidas: cada una tiene que ser
 * uno de los dos de su ronda (el dataset pudo cambiar) y no hay nada después del
 * primer error. Se queda con la parte válida desde el principio.
 */
export function restorePicks(stored: readonly unknown[] | undefined, rounds: readonly Round[]): string[] {
  const picks: string[] = [];
  for (const id of stored ?? []) {
    const round = rounds[picks.length];
    if (round === undefined || typeof id !== 'string' || (id !== round.a.id && id !== round.b.id)) break;
    picks.push(id);
    if (id !== winnerOf(round).id) break;
  }
  return picks;
}

/** Cuadrados por línea en la grilla para compartir. */
export const GRID_ROW = 10;

/**
 * Grilla para compartir: un cuadrado por jugada, 🟩 por cada acierto y 🟥 por el
 * error final, en líneas de `GRID_ROW`. Solo colores: no dice qué se comparó.
 */
export function shareGrid(score: number, failed: boolean): string[] {
  const squares = [...Array<string>(score).fill('🟩'), ...(failed ? ['🟥'] : [])];
  const lines: string[] = [];
  for (let start = 0; start < squares.length; start += GRID_ROW) lines.push(squares.slice(start, start + GRID_ROW).join(''));
  return lines;
}

/** Un valor listo para mostrar, con su unidad. */
export function formatValue(value: number, unit?: string): string {
  const text = value.toLocaleString('es-AR', { maximumFractionDigits: 2 });
  return unit ? `${text} ${unit}` : text;
}
