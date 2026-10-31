import { describe, expect, it } from 'vitest';
import type { Entity } from '@/engine/types';
import { previewPool } from './preview';
import entities from '../../../data/pokemon/entities.json';

const pool = entities as Entity[];
describe('roulette preview budget', () => {
  it.each([['g1'], ['g1', 'g2'], ['g1', 'g2', 'g4']])('balances selected generations (%s)', (...active) => {
    const reel = previewPool(pool, active);
    expect(reel).toHaveLength(30);
    expect(new Set(reel.map((entity) => entity.id)).size).toBe(30);
    for (const series of active) expect(reel.filter((entity) => entity.series.includes(series))).toHaveLength(30 / active.length);
    expect(reel.every((entity) => entity.image && entity.series.some((series) => active.includes(series)))).toBe(true);
  });
  it('uses the same lists across modes, input ordering and visits', () => {
    expect(previewPool([...pool].reverse(), ['g2', 'g1'])).toEqual(previewPool(pool, ['g1', 'g2']));
    const kanto = previewPool(pool, ['g1']).map((entity) => entity.id);
    expect(previewPool(pool, ['g1', 'g2']).filter((entity) => entity.series.includes('g1')).every((entity) => kanto.includes(entity.id))).toBe(true);
  });
  it('caps all generations at 30 and distributes the remainder evenly', () => {
    const active = Array.from({length: 9}, (_, i) => `g${i+1}`);
    const reel = previewPool(pool, active);
    expect(reel).toHaveLength(30);
    expect(active.map((series) => reel.filter((entity) => entity.series.includes(series)).length).every((count) => count === 3 || count === 4)).toBe(true);
  });
  it('handles small, overlapping and missing-image pools without duplicates', () => {
    const small = pool.slice(0, 5).map((entity) => ({...entity, series: ['a', 'b']}));
    expect(previewPool(small, ['a', 'b'])).toHaveLength(5);
    expect(previewPool(small.map((entity) => ({...entity, image: undefined})), ['a'])).toEqual([]);
    expect(previewPool(pool, [])).toEqual([]);
  });
});
