// Lógica pura del motor `reveal-list`. Sin React y sin nada de ninguna
// franquicia: recibe la configuración, las entidades y los contenidos por
// parámetro. Los intentos, las respuestas equivalentes y la elección del
// contenido del día son los mismos que en `text-clue` y se toman de ahí: lo
// propio de este motor es la lista de pistas y cuántas se ven.

import { eligibleContents, eligibleEntities } from '@/engine/filters';
import type { Content, Entity } from '@/engine/types';
import type { Candidate } from '../text-clue/logic';
import type { RevealListConfig } from './types';

export { failedCount, isCorrect, pickContent, restoreAttempts, shareGrid, winningAttempt } from '../text-clue/logic';
export type { Candidate } from '../text-clue/logic';

/** Las pistas de un contenido, en el orden en que se revelan. Lo que no es un texto o está vacío no cuenta. */
export function itemsOf(content: Content, field: string): string[] {
  const value = content.payload[field];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];
}

function byId(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Las respuestas posibles con las series activas: entidades elegibles (regla 1)
 * que tienen algún contenido elegible (regla 2) del tipo de la configuración y
 * con al menos una pista. Una entidad sin lista no puede ser la respuesta, pero
 * sí un intento: ver `eligibleEntities`.
 */
export function candidatesOf(
  entities: readonly Entity[],
  contents: readonly Content[],
  active: readonly string[],
  config: RevealListConfig,
): Candidate[] {
  const eligible = eligibleEntities(entities, active);
  const byEntity = new Map<string, Content[]>();
  for (const content of eligibleContents(contents, active)) {
    if (content.kind !== config.contentKind || content.entityId === undefined) continue;
    if (itemsOf(content, config.field).length === 0) continue;
    const list = byEntity.get(content.entityId);
    if (list) list.push(content);
    else byEntity.set(content.entityId, [content]);
  }

  return eligible.flatMap((entity) => {
    const own = byEntity.get(entity.id);
    return own === undefined ? [] : [{ id: entity.id, entity, contents: own.sort(byId) }];
  });
}

/** Cuántas pistas se ven con `failed` intentos fallidos: las iniciales más una por fallo, sin pasar del total. */
export function visibleCount(failed: number, total: number, initial = 1): number {
  return Math.min(total, Math.max(1, initial) + Math.max(0, failed));
}

export interface Slot {
  /** Posición de la pista, desde 1. */
  readonly position: number;
  readonly text: string;
  readonly revealed: boolean;
}

/** Todas las pistas con su estado. Al terminar la partida se pasa `Infinity` para mostrarlas todas. */
export function slotsOf(items: readonly string[], failed: number, initial = 1): Slot[] {
  const visible = visibleCount(failed, items.length, initial);
  return items.map((text, index) => ({ position: index + 1, text, revealed: index < visible }));
}
