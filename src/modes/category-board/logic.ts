import { seedFor, type DailyContext } from '@/engine/daily';
import { eligibleEntities } from '@/engine/filters';
import { mulberry32, shuffle } from '@/engine/rng';
import type { Entity } from '@/engine/types';
import type { GameState } from '@/engine/storage';
import type { BoardCategory, BoardDraft, BoardState, CategoryBoardConfig, RoundResult } from './types';

export const THEMATIC_COUNT = 8;
export const BOARD_SIZE = THEMATIC_COUNT + 1;
export const ATTEMPT_LIMITS = [5, 4, 3] as const;
export const emptyDraft = (): BoardDraft => ({ placements: [], phase: 'rolling' });
export const poolOf = (entities: readonly Entity[], active: readonly string[], config: CategoryBoardConfig): Entity[] =>
  eligibleEntities(entities, active).filter((entity) => config.roster.includes(entity.id) && !config.exclusions?.some((rule) => active.includes(rule.series) && rule.members.includes(entity.id))).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export const accepts = (category: BoardCategory, id: string): boolean => category.wildcard === true || category.members.includes(id);

/** Emparejamiento bipartito: una entidad distinta por casilla, también cuando las categorías se superponen. */
export function matchCategories(pool: readonly Entity[], categories: readonly BoardCategory[]): Entity[] | null {
  const owner = new Map<string, number>();
  const assignment = new Map<number, Entity>();
  function place(index: number, visited: Set<string>): boolean {
    for (const entity of pool) {
      if (visited.has(entity.id) || !accepts(categories[index], entity.id)) continue;
      visited.add(entity.id);
      const previous = owner.get(entity.id);
      if (previous === undefined || place(previous, visited)) {
        owner.set(entity.id, index);
        assignment.set(index, entity);
        return true;
      }
    }
    return false;
  }
  for (let i = 0; i < categories.length; i++) if (!place(i, new Set())) return null;
  return categories.map((_, i) => assignment.get(i)!);
}

/** Conserva las ocho preferidas donde se pueden jugar. Los filtros pueden activar categorías de reserva. */
export function categoriesOf(pool: readonly Entity[], config: CategoryBoardConfig, wildcard: BoardCategory, active: readonly string[]): BoardCategory[] {
  if (pool.length < BOARD_SIZE) return [];
  const selected: BoardCategory[] = [];
  for (const category of config.categories) {
    if (category.requiresSeries && !active.includes(category.requiresSeries)) continue;
    if (category.excludesSeries && active.includes(category.excludesSeries)) continue;
    if (selected.some((item) => item.id === category.id) || !pool.some((entity) => accepts(category, entity.id))) continue;
    if (matchCategories(pool, [...selected, category, wildcard]) !== null) selected.push(category);
    if (selected.length === THEMATIC_COUNT) return [...selected, wildcard];
  }
  return [];
}

/** Sorteo uniforme sin reemplazo: no filtra personajes para garantizar una solución. */
export function buildRound(pool: readonly Entity[], categories: readonly BoardCategory[], ctx: DailyContext, round: number): Entity[] {
  if (categories.length !== BOARD_SIZE || pool.length < BOARD_SIZE) return [];
  const rng = mulberry32(seedFor({ ...ctx, mode: `${ctx.mode}:board:${round}` }));
  const ordered = [...pool].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return shuffle(rng, ordered).slice(0, BOARD_SIZE);
}

export function availableCategories(categories: readonly BoardCategory[], placements: readonly string[], entityId: string): BoardCategory[] {
  return categories.filter((category) => !placements.includes(category.id) && accepts(category, entityId));
}

export const roundIndex = (state: BoardState): number => Math.max(0, state.rounds.length - (state.draft.phase === 'failed' || state.draft.phase === 'won' ? 1 : 0));

export const boardComplete = (categories: readonly BoardCategory[], placements: readonly string[]): boolean =>
  categories.filter((category) => !category.wildcard).length === THEMATIC_COUNT && categories.every((category) => category.wildcard || placements.includes(category.id));

/** Una elección incorrecta no consume el intento: se conserva el personaje para volver a ubicarlo. */
export function chooseCategory(state: BoardState, category: BoardCategory, entityId: string, categories: readonly BoardCategory[]): BoardState {
  if (state.draft.phase !== 'choosing' || state.draft.placements.includes(category.id)) return state;
  if (!accepts(category, entityId)) return { ...state, draft: { ...state.draft, rejectedCategory: category.id } };
  const placements = [...state.draft.placements, category.id];
  const complete = boardComplete(categories, placements);
  return {
    rounds: complete ? [...state.rounds, { placements, outcome: 'won' }] : state.rounds,
    draft: { placements, phase: complete ? 'won' : 'placed' },
  };
}

function validPlacements(raw: unknown, draws: readonly Entity[], categories: readonly BoardCategory[]): raw is string[] {
  return Array.isArray(raw) && raw.length <= BOARD_SIZE && new Set(raw).size === raw.length && raw.every((id, index) =>
    typeof id === 'string' && draws[index] !== undefined && categories.some((category) => category.id === id && accepts(category, draws[index].id)));
}

/** Revalida el historial y el borrador contra la secuencia diaria, sin confiar en objetos de localStorage. */
export function restoreGame(saved: GameState | null, drawsFor: (round: number) => readonly Entity[], categories: readonly BoardCategory[], limit: number): BoardState {
  const rounds: RoundResult[] = [];
  for (const raw of saved?.attempts ?? []) {
    if (rounds.length >= limit || typeof raw !== 'object' || raw === null) break;
    const item = raw as Partial<RoundResult>;
    const draws = drawsFor(rounds.length);
    if (!validPlacements(item.placements, draws, categories)) break;
    const current = draws[item.placements.length];
    const blocked = current && availableCategories(categories, item.placements, current.id).length === 0;
    const wrong = current && categories.some((category) => category.id === item.rejectedCategory && !item.placements!.includes(category.id) && !accepts(category, current.id));
    if (item.outcome === 'won' ? !boardComplete(categories, item.placements) : item.outcome === 'blocked' ? !blocked : item.outcome === 'wrong' ? !wrong : true) break;
    rounds.push({ placements: item.placements, outcome: item.outcome as RoundResult['outcome'], ...(item.rejectedCategory ? { rejectedCategory: item.rejectedCategory } : {}) });
    if (item.outcome === 'won') break;
  }
  const last = rounds.at(-1);
  const won = last?.outcome === 'won';
  const rawDraft = saved?.draft;
  const draft = typeof rawDraft === 'object' && rawDraft !== null ? rawDraft as Partial<BoardDraft> : null;
  if (won || (last && (rounds.length >= limit || draft?.phase === 'failed'))) {
    return { rounds, draft: { placements: last!.placements, phase: won ? 'won' : 'failed', rejectedCategory: last!.rejectedCategory } };
  }
  const draws = drawsFor(rounds.length);
  if (draft && validPlacements(draft.placements, draws, categories) && boardComplete(categories, draft.placements)) {
    return { rounds: [...rounds, { placements: draft.placements, outcome: 'won' }], draft: { placements: draft.placements, phase: 'won' } };
  }
  if (draft && validPlacements(draft.placements, draws, categories) && draft.placements.length < BOARD_SIZE && ['rolling', 'choosing', 'placed'].includes(draft.phase ?? '') && (draft.phase !== 'placed' || draft.placements.length > 0)) {
    const rejectedCategory = draft.phase === 'choosing' && categories.some((category) => category.id === draft.rejectedCategory && !draft.placements!.includes(category.id) && !accepts(category, draws[draft.placements!.length].id)) ? draft.rejectedCategory : undefined;
    return { rounds, draft: { placements: draft.placements, phase: draft.phase!, ...(rejectedCategory ? { rejectedCategory } : {}) } };
  }
  return { rounds, draft: emptyDraft() };
}
