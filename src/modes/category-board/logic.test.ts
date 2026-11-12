import { describe, expect, it } from 'vitest';
import type { Entity } from '@/engine/types';
import { es } from '@/i18n/es';
import { accepts, ATTEMPT_LIMITS, availableCategories, BOARD_SIZE, buildRound, chooseCategory, confirmPlacement, matchCategories, restoreGame, roundIndex } from './logic';
import type { BoardCategory } from './types';

const wildcard: BoardCategory = { ...es.categoryBoard.wildcard, members: [], wildcard: true };
const entity = (id: string): Entity => ({ id, name: { es: id }, aliases: [], series: ['s'], attrs: {} });

describe('Casillas: distribución, reglas y restauración', () => {
  it('conserva todos los intentos gastados al restaurar cada dificultad agotada', () => {
    const emptyCategories = Array.from({ length: 8 }, (_, index) => ({ id: `c${index}`, label: '', help: '', members: [] }));
    const categories = [...emptyCategories, wildcard];
    const draws = Array.from({ length: 9 }, (_, index) => entity(`spent${index}`));
    for (const limit of ATTEMPT_LIMITS) {
      const attempts = Array.from({ length: limit }, () => ({ placements: ['comodin'], outcome: 'blocked' }));
      const restored = restoreGame({ attempts, result: 'lost', draft: { phase: 'failed', placements: ['comodin'] } }, () => draws, categories, limit);
      expect(restored.rounds.filter((round) => round.outcome !== 'won')).toHaveLength(limit);
      expect(restored.draft.phase).toBe('failed');
    }
  });
  it('resuelve superposiciones sin usar el mismo personaje en dos categorías', () => {
    const categories = [
      { id: 'a', label: 'A', help: '', members: ['one', 'two'] },
      { id: 'b', label: 'B', help: '', members: ['one'] },
      wildcard,
    ];
    const result = matchCategories(['one', 'two', 'three'].map(entity), categories)!;
    expect(result.map((item) => item.id)).toEqual(['two', 'one', 'three']);
    expect(matchCategories([entity('one')], categories)).toBeNull();
  });

  it('el comodín solo queda disponible hasta ocuparlo y los intentos son 5/4/3', () => {
    const categories = [{ id: 'specific', label: 'S', help: '', members: ['one'] }, wildcard];
    expect(availableCategories(categories, [], 'outside').map((item) => item.id)).toEqual(['comodin']);
    expect(availableCategories(categories, ['comodin'], 'outside')).toEqual([]);
    expect(availableCategories(categories, ['specific'], 'one').map((item) => item.id)).toEqual(['comodin']);
    expect(ATTEMPT_LIMITS).toEqual([5, 4, 3]);
  });

  const pool = Array.from({ length: 12 }, (_, index) => entity(`e${index}`));
  const categories: BoardCategory[] = [...Array.from({ length: 8 }, (_, index) => ({ id: `c${index}`, label: `C${index}`, help: '', members: [`e${index}`] })), wildcard];
  const ctx = { franchise: 'test', mode: 'casillas', day: 300, filterKey: 'all~d2' };
  const drawsFor = (index: number) => buildRound(pool, categories, ctx, index);

  it('rechazar una casilla conserva el personaje, el comodín y los intentos incluso tras recargar', () => {
    const current = drawsFor(0)[0];
    const wrong = categories.find((category) => !accepts(category, current.id))!;
    const rejected = chooseCategory({ rounds: [], draft: { placements: [], phase: 'choosing' } }, wrong, current.id, categories);
    expect(rejected.rounds).toEqual([]);
    expect(rejected.draft).toEqual({ placements: [], phase: 'choosing', rejectedCategory: wrong.id });
    const restored = restoreGame({ attempts: [], draft: rejected.draft, result: 'playing' }, drawsFor, categories, 4);
    expect(restored).toEqual(rejected);
    expect(availableCategories(categories, restored.draft.placements, current.id)).toContain(wildcard);
    const placed = chooseCategory(restored, wildcard, current.id, categories);
    expect(placed.draft).toEqual({ placements: ['comodin'], phase: 'placed' });
    expect(placed.rounds).toEqual([]);
  });

  it('gana al completar las ocho categorías con el comodín libre y restaura esa victoria', () => {
    const thematic = categories.filter((category) => !category.wildcard);
    const placements = thematic.slice(0, -1).map((category) => category.id);
    const last = thematic.at(-1)!;
    const next = chooseCategory({ rounds: [], draft: { placements, phase: 'choosing' } }, last, last.members[0], categories);
    expect(next.draft.phase).toBe('won');
    expect(next.draft.placements).toHaveLength(8);
    expect(next.draft.placements).not.toContain(wildcard.id);
    const ordered = thematic.map((category) => entity(category.members[0]));
    expect(restoreGame({ attempts: [...next.rounds], result: 'won' }, () => ordered, categories, 2).draft.phase).toBe('won');
    expect(restoreGame({ attempts: [], draft: { placements: next.draft.placements, phase: 'placed' }, result: 'playing' }, () => ordered, categories, 2).draft.phase).toBe('won');
  });

  it('usar el comodín no reemplaza una categoría pendiente', () => {
    const thematic = categories.filter((category) => !category.wildcard);
    const placements = [wildcard.id, ...thematic.slice(0, -2).map((category) => category.id)];
    const penultimate = thematic.at(-2)!;
    const next = chooseCategory({ rounds: [], draft: { placements, phase: 'choosing' } }, penultimate, penultimate.members[0], categories);
    expect(next.draft.phase).toBe('placed');
    const last = thematic.at(-1)!;
    const won = chooseCategory({ ...next, draft: { ...next.draft, phase: 'choosing' } }, last, last.members[0], categories);
    expect(won.draft.phase).toBe('won');
    expect(won.draft.placements).toHaveLength(9);
  });

  it('permite mover el último personaje y fija solo su casilla al avanzar', () => {
    const first = chooseCategory({ rounds: [], draft: { placements: [], phase: 'choosing' } }, wildcard, 'e0', categories, true);
    const moved = chooseCategory(first, categories[0], 'e0', categories, true);
    expect(moved.draft.placements).toEqual(['c0']);
    const rejected = chooseCategory(moved, categories[1], 'e0', categories, true);
    expect(rejected.draft).toEqual({ placements: ['c0'], phase: 'placed', rejectedCategory: 'c1' });
    const confirmed = confirmPlacement(rejected, categories, 'choosing');
    expect(confirmed.draft).toEqual({ placements: ['c0'], phase: 'choosing' });
    expect(chooseCategory(confirmed, categories[0], 'e1', categories, true)).toBe(confirmed);
    expect(chooseCategory(confirmed, categories[1], 'e1', categories, true).draft.placements).toEqual(['c0', 'c1']);
  });

  it('gana al completar el tablero aunque el comodín siga libre y la colocación sea editable', () => {
    const thematic = categories.filter((category) => !category.wildcard);
    const draft = { placements: thematic.map(({ id }) => id), phase: 'placed' as const };
    const draws = pool.slice(0, 9);
    const restored = restoreGame({ attempts: [], draft, result: 'playing' }, () => draws, categories, 4, true);
    const before = { rounds: [], draft: { placements: draft.placements.slice(0, -1), phase: 'choosing' as const } };
    const won = chooseCategory(before, thematic.at(-1)!, 'e7', categories, true);
    expect(won.draft.phase).toBe('won');
    expect(restored).toEqual(won);
    expect(chooseCategory(won, wildcard, 'e7', categories, true)).toBe(won);
  });

  it('reproduce la secuencia al reordenar los datos y separa días e intentos', () => {
    const first = drawsFor(0).map((item) => item.id);
    expect(buildRound([...pool].reverse().sort((a, b) => a.id < b.id ? -1 : 1), categories, ctx, 0).map((item) => item.id)).toEqual(first);
    expect(drawsFor(1).map((item) => item.id)).not.toEqual(first);
    expect(buildRound(pool, categories, { ...ctx, day: 301 }, 0).map((item) => item.id)).not.toEqual(first);
  });

  it('restaura cada fase sin cambiar el personaje ni aceptar colocaciones repetidas o falsas', () => {
    const current = drawsFor(0)[0];
    const category = categories.find((item) => accepts(item, current.id))!;
    for (const phase of ['rolling', 'choosing', 'placed'] as const) {
      const draft = { phase, placements: [category.id] };
      expect(restoreGame({ attempts: [], result: 'playing', draft }, drawsFor, categories, 4).draft).toEqual(draft);
    }
    expect(restoreGame({ attempts: [], result: 'playing', draft: { phase: 'choosing', placements: [category.id, category.id] } }, drawsFor, categories, 4).draft.placements).toEqual([]);
    expect(restoreGame({ attempts: [{ placements: [], outcome: 'won' }], result: 'won' }, drawsFor, categories, 4).rounds).toEqual([]);
  });

  it('restaura una derrota y el siguiente intento con índices diferentes', () => {
    const current = drawsFor(0)[0];
    const wrong = categories.find((item) => !accepts(item, current.id))!;
    const round = { placements: [], outcome: 'wrong', rejectedCategory: wrong.id };
    const failed = restoreGame({ attempts: [round], result: 'playing', draft: { phase: 'failed' } }, drawsFor, categories, 4);
    expect(failed.draft.phase).toBe('failed');
    expect(roundIndex(failed)).toBe(0);
    const next = restoreGame({ attempts: [round], result: 'playing', draft: { placements: [], phase: 'rolling' } }, drawsFor, categories, 4);
    expect(roundIndex(next)).toBe(1);
  });

  it('restaura el tablero ganado y rechaza un falso bloqueo que todavía tiene comodín', () => {
    const draws = pool.slice(0, BOARD_SIZE);
    const order = draws.map((item) => categories.find((category) => !category.wildcard && accepts(category, item.id))?.id ?? wildcard.id);
    const state = restoreGame({ attempts: [{ placements: order, outcome: 'won' }], result: 'won' }, () => draws, categories, 4);
    expect(state.draft.phase).toBe('won');
    expect(state.draft.placements).toHaveLength(BOARD_SIZE);
    expect(roundIndex(state)).toBe(0);
    expect(restoreGame({ attempts: [{ placements: [], outcome: 'blocked' }], result: 'lost' }, drawsFor, categories, 4).rounds).toEqual([]);
  });

  it('sortea todo el catálogo sin forzar candidatos con solución', () => {
    const seen = new Set<string>();
    let impossible = false;
    for (let day = 0; day < 100; day++) {
      const draws = buildRound(pool, categories, { ...ctx, day }, 0);
      expect(new Set(draws.map((item) => item.id)).size).toBe(BOARD_SIZE);
      draws.forEach((item) => seen.add(item.id));
      impossible ||= matchCategories(draws, categories) === null;
    }
    expect(seen.size).toBe(pool.length);
    expect(impossible).toBe(true);
  });
});

