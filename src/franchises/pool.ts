import { defaultMinPool, eligibleEntities } from '@/engine/filters';
import { poolOf as connectionsPool } from '@/modes/connections/logic';
import { candidatesOf as imageCandidates } from '@/modes/image-reveal/logic';
import { poolOf as higherLowerPool } from '@/modes/higher-lower/logic';
import { candidatesOf as listCandidates } from '@/modes/reveal-list/logic';
import { candidatesOf as textCandidates } from '@/modes/text-clue/logic';
import { poolOf as timelinePool } from '@/modes/timeline/logic';
import { entitiesOfMode, type FranchiseData } from './data';
import type { ModeConfig } from './types';

/**
 * Cuántas opciones tiene un modo con las series activas: lo que cada motor llama su pool
 * (respuestas posibles, pares posibles o sucesos). `null` si el modo no tiene la
 * configuración de su motor (todavía no se puede jugar). Es lo mismo que cada juego le
 * pasa a `GameShell` como `poolSize`.
 */
export function modePoolSize(mode: ModeConfig, data: FranchiseData, active: readonly string[]): number | null {
  const entities = entitiesOfMode(data, mode.entitySet);
  switch (mode.engine) {
    case 'classic':
      return mode.classic === undefined ? null : eligibleEntities(entities, active).length;
    case 'image-reveal':
      return mode.imageReveal === undefined ? null : imageCandidates(entities, data.contents, active, mode.imageReveal).length;
    case 'text-clue':
      return mode.textClue === undefined ? null : textCandidates(entities, data.contents, active, mode.textClue).length;
    case 'reveal-list':
      return mode.revealList === undefined ? null : listCandidates(entities, data.contents, active, mode.revealList).length;
    case 'higher-lower':
      return mode.higherLower === undefined ? null : higherLowerPool(entities, active, mode.higherLower.metrics).length;
    case 'timeline':
      return mode.timeline === undefined ? null : timelinePool(data.contents, active, mode.timeline).length;
    case 'connections':
      return mode.connections === undefined ? null : connectionsPool(entities, data.contents, active, mode.connections).length;
  }
}

/** El mínimo de pool de un modo (regla 6 de la SPEC): el de su motor. */
export function minimumPoolOf(mode: ModeConfig): number {
  return defaultMinPool(mode.engine);
}
