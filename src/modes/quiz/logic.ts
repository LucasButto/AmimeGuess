// Lógica pura del motor `quiz`. Sin React y sin nada de ninguna franquicia: recibe la configuración y los contenidos
// por parámetro. La pregunta de un día sale del pool ordenado por id y de una mezcla con semilla (SPEC 5, "Modos de
// secuencia"): nunca de azar ni de un reloj, así dos personas con los mismos filtros contestan la misma pregunta y con
// las mismas opciones. El orden en que se ven las opciones sí es al azar, en cada visita (lo mezcla el tablero).

import type { DailyContext } from '@/engine/daily';
import { eligibleContents, eligibleEntities } from '@/engine/filters';
import { fnv1a32 } from '@/engine/hash';
import { mulberry32, shuffle } from '@/engine/rng';
import type { Content, Entity } from '@/engine/types';
import { DEFAULT_OPTIONS, type QuizConfig } from './types';

/** Cuántas opciones tiene la pregunta: las de la configuración o, sin ellas, `DEFAULT_OPTIONS`. */
export const optionCountOf = (config: QuizConfig): number => Math.max(2, config.options ?? DEFAULT_OPTIONS);

// --- Pool ---------------------------------------------------------------------

/** Una pregunta lista para jugar. */
export interface Question {
  readonly id: string;
  readonly text: string;
  readonly scope?: string;
  /** Id de la única respuesta correcta. */
  readonly correct: string;
  /** Ids de las opciones incorrectas, sin repetir y sin la correcta. */
  readonly distractors: readonly string[];
  readonly explanation?: string;
}

function byId(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function textOf(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

/**
 * Las preguntas que pueden salir con las series activas: contenidos elegibles (regla 2) del tipo de la configuración
 * con un texto, una respuesta y distractores suficientes para las opciones que pide. Lo que se apaga no aparece nunca,
 * tampoco como opción: la respuesta tiene que ser una entidad elegible (regla 1) y los distractores de series apagadas
 * (o de relleno o arcos del manga apagados) se descartan; si no quedan los que hacen falta, la pregunta no sale.
 * Ordenadas por id: de ese orden depende la elección, así que no puede depender del de los datos.
 */
export function poolOf(entities: readonly Pick<Entity, 'id' | 'series'>[], contents: readonly Content[], active: readonly string[], config: QuizConfig): Question[] {
  const needed = optionCountOf(config) - 1;
  const available = new Set(eligibleEntities(entities, active).map((entity) => entity.id));
  const questions: Question[] = [];
  for (const content of eligibleContents(contents, active)) {
    if (content.kind !== config.contentKind) continue;
    const text = textOf(content.payload[config.questionField]);
    const correct = textOf(content.payload[config.correctField]);
    const raw = content.payload[config.distractorsField];
    if (text === undefined || correct === undefined || !Array.isArray(raw) || !available.has(correct)) continue;
    const distractors = [...new Set(raw.filter((id): id is string => typeof id === 'string' && id !== correct && available.has(id)))];
    if (distractors.length < needed) continue;
    questions.push({
      id: content.id,
      text,
      scope: config.scopeField === undefined ? undefined : textOf(content.payload[config.scopeField]),
      correct,
      distractors,
      explanation: config.explanationField === undefined ? undefined : textOf(content.payload[config.explanationField]),
    });
  }
  return questions.sort(byId);
}

// --- La pregunta de un día ------------------------------------------------------

/**
 * La pregunta del día. El pool se baraja con una semilla que cambia cada vez que se agotó (`ciclo`) y cada día toma la
 * siguiente: no se repite ninguna hasta haber pasado por todo el pool. Depende solo de (franquicia, modo, filtros, día) y
 * del pool. `null` si el pool está vacío.
 */
export function questionOf(pool: readonly Question[], ctx: DailyContext): Question | null {
  if (pool.length === 0) return null;
  const cycle = Math.floor(ctx.day / pool.length);
  const slot = ctx.day - cycle * pool.length;
  const rng = mulberry32(fnv1a32(`${ctx.franchise}|${ctx.mode}|${ctx.filterKey}|quiz|${cycle}`));
  // Ordenado por id antes de mezclar: el resultado no puede depender del orden en que vengan los datos.
  return shuffle(rng, [...pool].sort(byId))[slot];
}

/**
 * Las opciones de la pregunta, en el orden en que se ven: la correcta y `count - 1` de sus distractores, elegidos y
 * mezclados con una semilla del día y de la pregunta.
 */
export function optionsFor(question: Question, count: number, ctx: DailyContext): string[] {
  const rng = mulberry32(fnv1a32(`${ctx.franchise}|${ctx.mode}|${ctx.filterKey}|${ctx.day}|${question.id}`));
  const others = shuffle(rng, question.distractors).slice(0, Math.max(1, count) - 1);
  return shuffle(rng, [question.correct, ...others]);
}

// --- Jugar: de las elecciones guardadas al estado de la partida ----------------------

export interface QuizProgress {
  /** Las opciones elegidas, en orden: solo las válidas (las guardadas que ya no valen se descartan desde la primera inválida). */
  readonly picks: readonly string[];
  /** Se eligió la opción correcta. */
  readonly solved: boolean;
  /** Ya no se puede seguir: se acertó o se gastaron los intentos. */
  readonly over: boolean;
  /** Opciones elegidas que no eran la correcta. */
  readonly mistakes: number;
}

/**
 * Reproduce las elecciones guardadas. Cada elección tiene que ser una de las opciones de hoy, sin repetirse (el dataset
 * pudo cambiar), y no hay nada después de acertar ni más de `limit`. Se queda con la parte válida desde el principio.
 */
export function replay(stored: readonly unknown[] | undefined, options: readonly string[], question: Pick<Question, 'correct'>, limit: number): QuizProgress {
  const picks: string[] = [];
  for (const pick of stored ?? []) {
    if (picks.length >= limit || picks.includes(question.correct)) break;
    if (typeof pick !== 'string' || !options.includes(pick) || picks.includes(pick)) break;
    picks.push(pick);
  }
  const solved = picks.includes(question.correct);
  return { picks, solved, over: solved || picks.length >= limit, mistakes: picks.length - (solved ? 1 : 0) };
}

/** Grilla para compartir: un cuadrado por elección (🟥 si no era, 🟩 la correcta) en una sola línea. No dice cuáles eran. */
export function shareGrid(progress: Pick<QuizProgress, 'picks' | 'mistakes' | 'solved'>): string[] {
  if (progress.picks.length === 0) return [];
  return [`${'🟥'.repeat(progress.mistakes)}${progress.solved ? '🟩' : ''}`];
}
