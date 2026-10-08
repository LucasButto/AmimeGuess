// Lógica pura del motor `text-clue`. Sin React y sin nada de ninguna franquicia:
// recibe la configuración, las entidades y los contenidos por parámetro. Todo
// lo que elige (la respuesta, qué contenido usa) sale de
// `(franchise, mode, filterKey, day)` y del dataset: nunca de azar ni de un reloj.

import type { DailyContext } from '@/engine/daily';
import { eligibleContents, eligibleEntities } from '@/engine/filters';
import { fmix32, fnv1a32 } from '@/engine/hash';
import type { AttrValue, Content, Entity } from '@/engine/types';
import type { TextClueConfig, TextClueLine } from './types';

// --- Texto de una línea -------------------------------------------------------

/** Un texto o un número como texto; cualquier otra cosa, o un texto vacío, es "no hay dato". */
function asText(value: unknown): string | null {
  if (typeof value === 'string') return value.length > 0 ? value : null;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

/** Valor de un atributo listo para mostrar: las listas van separadas por comas. `null` si no tiene valor. */
function formatAttr(value: AttrValue | undefined): string | null {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) {
    const items = value.map((item) => (typeof item === 'string' ? item : item.value));
    return items.length > 0 ? items.join(', ') : null;
  }
  return asText(value);
}

/** El texto de una línea para esta respuesta, o `null` si ese dato no existe. */
export function lineText(line: TextClueLine, entity: Entity, content: Content): string | null {
  if (line.kind === 'content') return asText(content.payload[line.field]);
  const values = line.keys.flatMap((key) => {
    const text = formatAttr(entity.attrs[key]);
    return text === null ? [] : [text];
  });
  return values.length > 0 ? values.join(' / ') : null;
}

// --- Respuestas posibles ------------------------------------------------------

/** Una posible respuesta del día, con los contenidos que sirven para mostrarla. */
export interface Candidate {
  /** El de la entidad: es lo que usa `pickDaily`. */
  readonly id: string;
  readonly entity: Entity;
  /** Ordenados por id: el orden de los contenidos en el dataset no influye en el elegido. */
  readonly contents: readonly Content[];
}

function byId(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Un contenido sirve si tiene el dato de la pista principal (las líneas con
 * `after: 0` de contenido): sin eso no habría nada que mostrar al empezar.
 */
function isUsable(content: Content, entity: Entity, config: TextClueConfig): boolean {
  return config.lines.every((line) => line.after > 0 || lineText(line, entity, content) !== null);
}

/**
 * Las respuestas posibles con las series activas: entidades elegibles (regla 1)
 * que tienen algún contenido elegible (regla 2) del tipo de la configuración.
 * Una entidad sin contenido no puede ser la respuesta, pero sí un intento: ver
 * `eligibleEntities`.
 */
export function candidatesOf(
  entities: readonly Entity[],
  contents: readonly Content[],
  active: readonly string[],
  config: TextClueConfig,
): Candidate[] {
  const eligible = eligibleEntities(entities, active);
  const byEntity = new Map<string, Content[]>();
  for (const content of eligibleContents(contents, active)) {
    if (content.kind !== config.contentKind || content.entityId === undefined) continue;
    const list = byEntity.get(content.entityId);
    if (list) list.push(content);
    else byEntity.set(content.entityId, [content]);
  }

  return eligible.flatMap((entity) => {
    const usable = (byEntity.get(entity.id) ?? []).filter((content) => isUsable(content, entity, config));
    return usable.length === 0 ? [] : [{ id: entity.id, entity, contents: usable.sort(byId) }];
  });
}

/** El contenido del día de una respuesta que tiene varios: uno elegido con un hash del día. */
export function pickContent(candidate: Candidate, ctx: DailyContext): Content {
  const { contents } = candidate;
  if (contents.length === 1) return contents[0];
  const hash = fmix32(fnv1a32(`${ctx.franchise}|${ctx.mode}|${ctx.filterKey}|${ctx.day}|${candidate.id}|clue`));
  return contents[hash % contents.length];
}

// --- Intentos -----------------------------------------------------------------

/** Ids de otras entidades que también son respuestas correctas de este contenido. */
export function acceptedIds(content: Content): string[] {
  const { accepts } = content.payload;
  return Array.isArray(accepts) ? accepts.filter((id): id is string => typeof id === 'string') : [];
}

/** ¿Acierta este intento? La respuesta del día o cualquiera de las que el contenido acepta. */
export function isCorrect(guessId: string, answerId: string, content: Content): boolean {
  return guessId === answerId || acceptedIds(content).includes(guessId);
}

/** El primer intento que acertó, o `null` si todavía no hay. */
export function winningAttempt(attemptIds: readonly string[], answerId: string, content: Content): string | null {
  return attemptIds.find((id) => isCorrect(id, answerId, content)) ?? null;
}

/** Intentos que no acertaron: son los que desbloquean pistas. */
export function failedCount(attemptIds: readonly string[], answerId: string, content: Content): number {
  return attemptIds.filter((id) => !isCorrect(id, answerId, content)).length;
}

/**
 * Los intentos guardados que siguen siendo válidos: sin repetidos y solo de
 * entidades que están entre las opciones actuales (el dataset pudo cambiar).
 */
export function restoreAttempts(stored: readonly unknown[] | undefined, options: readonly Pick<Entity, 'id'>[]): string[] {
  const valid = new Set(options.map((entity) => entity.id));
  const seen = new Set<string>();
  const restored: string[] = [];
  for (const id of stored ?? []) {
    if (typeof id === 'string' && valid.has(id) && !seen.has(id)) {
      seen.add(id);
      restored.push(id);
    }
  }
  return restored;
}

/**
 * Grilla para compartir: una línea por intento, en el orden en que se jugaron.
 * Solo rojo para el que falló y verde para el que acertó: no revela nada de la
 * respuesta.
 */
export function shareGrid(attemptIds: readonly string[], winnerId: string | null): string[] {
  return attemptIds.map((id) => (id === winnerId ? '🟩' : '🟥'));
}

// --- Pistas -------------------------------------------------------------------

export interface LineState {
  readonly line: TextClueLine;
  readonly unlocked: boolean;
  /** Cuántos fallos más faltan para desbloquearla (0 si ya está). */
  readonly remaining: number;
  /** El texto, también de las bloqueadas: la interfaz decide si lo muestra. */
  readonly text: string;
}

/**
 * El estado de cada línea con `failed` fallos, en el orden de la configuración.
 * Las líneas cuyo dato no existe para esta respuesta se omiten. Al terminar la
 * partida se pasan todos los fallos que hagan falta para mostrarlas todas
 * (`Infinity`).
 */
export function lineStates(
  lines: readonly TextClueLine[],
  failed: number,
  entity: Entity,
  content: Content,
): LineState[] {
  return lines.flatMap((line) => {
    const text = lineText(line, entity, content);
    if (text === null) return [];
    return [{ line, unlocked: failed >= line.after, remaining: Math.max(0, line.after - failed), text }];
  });
}
