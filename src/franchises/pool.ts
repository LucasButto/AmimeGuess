import type { PoolNoun } from '@/components/FilterPanel';
import { defaultMinPool, eligibleEntities } from '@/engine/filters';
import { es } from '@/i18n/es';
import { poolOf as connectionsPool } from '@/modes/connections/logic';
import { candidatesOf as imageCandidates } from '@/modes/image-reveal/logic';
import { poolOf as higherLowerPool } from '@/modes/higher-lower/logic';
import { poolOf as quizPool } from '@/modes/quiz/logic';
import { candidatesOf as listCandidates } from '@/modes/reveal-list/logic';
import { candidatesOf as textCandidates } from '@/modes/text-clue/logic';
import { poolOf as timelinePool } from '@/modes/timeline/logic';
import { entitiesOfMode, type FranchiseData } from './data';
import type { FranchiseConfig, ModeConfig } from './types';
import { categoriesOf as boardCategories, poolOf as boardPool, BOARD_SIZE } from '@/modes/category-board/logic';

/**
 * Cuántas opciones tiene un modo con las series activas: lo que cada motor llama su pool
 * (respuestas posibles, pares posibles o sucesos; en los modos que cuentan contenidos, como Jutsu y Técnica, los contenidos). `null` si el
 * modo no tiene la configuración de su motor (todavía no se puede jugar). Es con lo que `GameShell` mide el mínimo para jugar.
 */
export function modePoolSize(mode: ModeConfig, data: FranchiseData, active: readonly string[]): number | null {
  const entities = entitiesOfMode(data, mode.entitySet);
  switch (mode.engine) {
    case 'category-board': {
      if (!mode.categoryBoard) return null;
      const pool = boardPool(entities, active, mode.categoryBoard);
      return boardCategories(pool, mode.categoryBoard, { ...es.categoryBoard.wildcard, members: [], wildcard: true }, active).length === BOARD_SIZE ? pool.length : 0;
    }
    case 'stat-builder':
      return mode.statBuilder === undefined ? null : eligibleEntities(entities, active).filter((entity) => mode.statBuilder!.stats.every((stat) => typeof entity.attrs[stat.key] === 'number')).length;
    case 'classic':
      return mode.classic === undefined ? null : eligibleEntities(entities, active).length;
    case 'image-reveal': {
      if (mode.imageReveal === undefined) return null;
      const candidates = imageCandidates(entities, data.contents, active, mode.imageReveal);
      // Un modo que cuenta contenidos (cada técnica o jutsu es un clip) mide el mínimo con ellos y no con los personajes que son respuesta:
      // 12 técnicas de 6 personajes alcanzan. Las opciones del buscador siguen siendo todos los personajes de las series activas.
      return mode.imageReveal.countNoun === undefined ? candidates.length : candidates.reduce((sum, candidate) => sum + candidate.images.length, 0);
    }
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
    case 'quiz':
      return mode.quiz === undefined ? null : quizPool(entities, data.contents, active, mode.quiz).length;
  }
}

/**
 * Cómo se llama lo que cuenta el contador de posibles de un modo: los sucesos de una línea de tiempo, los grupos de las
 * conexiones, las preguntas de un quiz o, en los demás, las entidades que se adivinan (las de su conjunto, o las principales de la franquicia).
 * `undefined` si la config no las nombra: el contador dice solo "N posibles".
 */
export function modePoolNoun(franchise: FranchiseConfig, mode: ModeConfig): PoolNoun | undefined {
  if (mode.engine === 'timeline') return es.filters.nouns.events;
  if (mode.engine === 'connections') return es.filters.nouns.groups;
  if (mode.engine === 'quiz') return es.filters.nouns.questions;
  if (mode.engine === 'image-reveal' && mode.imageReveal?.countNoun !== undefined) return mode.imageReveal.countNoun;
  return mode.entitySet === undefined ? franchise.entityNoun : franchise.entitySetNouns?.[mode.entitySet];
}

/** El mínimo de pool de un modo (regla 6 de la SPEC): el de su motor. */
export function minimumPoolOf(mode: ModeConfig): number {
  return defaultMinPool(mode.engine);
}
