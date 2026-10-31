import { describe, expect, it } from 'vitest';
import type { Entity } from '@/engine/types';
import { bestBuild, draw, limitFor, outcomeOf, restoreBuild, totalOf } from './logic';
const config = { targets: [500, 550, 600], stats: [{ key: 'ps', label: 'PS' }, { key: 'attack', label: 'Attack' }] };
const pool: Entity[] = Array.from({ length: 20 }, (_, i) => ({ id: `e${i}`, name: { es: `E${i}` }, aliases: [], series: ['s'], attrs: { ps: 50 + i, attack: 100 + i } }));
const ctx = { franchise: 'test', mode: 'fusion', filterKey: 'all', day: 100 };
describe('Estadísticas', () => {
  it('permite 3/4/5 partidas completas y solo gana al superar la meta', () => {
    expect([0, 1, 2].map((level) => limitFor(4, level))).toEqual([3, 4, 5]);
    expect([0, 1, 2].map((level) => limitFor(6, level))).toEqual([5, 6, 7]);
    const build = [{ key: 'ps', entityId: 'e0' }, { key: 'attack', entityId: 'e0' }];
    expect(outcomeOf([build], pool, 150, 3)).toEqual({ won: false, over: false });
    expect(outcomeOf([build, build, build], pool, 150, 3)).toEqual({ won: false, over: true });
    expect(outcomeOf([build], pool, 149, 3)).toEqual({ won: true, over: true });
  });
  it('sortea la misma secuencia diaria y separa las partidas y posiciones', () => {
    const sequence = Array.from({ length: 6 }, (_, i) => draw(pool, ctx, 0, i).id);
    expect(Array.from({ length: 6 }, (_, i) => draw(pool, ctx, 0, i).id)).toEqual(sequence);
    expect(Array.from({ length: 6 }, (_, i) => draw(pool, ctx, 1, i).id)).not.toEqual(sequence);
    expect(sequence.every((id) => pool.some((entity) => entity.id === id))).toBe(true);
  });
  it('suma únicamente el valor de la estadística asignada a cada Pokémon', () => {
    expect(totalOf([{ key: 'ps', entityId: 'e0' }, { key: 'attack', entityId: 'e1' }], pool)).toBe(151);
  });
  it('restaura solo estadísticas únicas, válidas y con Pokémon del pool', () => {
    expect(restoreBuild([{ key: 'ps', entityId: 'e0' }, { key: 'ps', entityId: 'e1' }], pool, config)).toEqual([{ key: 'ps', entityId: 'e0' }]);
    expect(restoreBuild([{ key: 'attack', entityId: 'outside' }], pool, config)).toEqual([]);
    expect(restoreBuild(null, pool, config)).toEqual([]);
  });
});


describe('best possible assignment', () => {
  const entities: Entity[] = [
    { id: 'a', name: { es: 'A' }, aliases: [], series: ['s'], attrs: { ps: 90, attack: 100 } },
    { id: 'b', name: { es: 'B' }, aliases: [], series: ['s'], attrs: { ps: 80, attack: 1 } },
  ];
  it('finds the global maximum rather than greedily taking the largest value of each slot', () => {
    const original = [{ key: 'ps', entityId: 'a' }, { key: 'attack', entityId: 'b' }];
    const best = bestBuild(original, entities);
    expect(best).toEqual([{ key: 'ps', entityId: 'b' }, { key: 'attack', entityId: 'a' }]);
    expect(totalOf(best, entities)).toBe(180);
    expect(original[0].entityId).toBe('a');
  });
  it('preserves repeated draws and keeps the original combination when it is optimal', () => {
    const original = [{ key: 'ps', entityId: 'a' }, { key: 'attack', entityId: 'a' }];
    expect(bestBuild(original, entities)).toEqual(original);
    expect(bestBuild([], entities)).toEqual([]);
  });
});
