import { fnv1a32 } from '@/engine/hash';
import { mulberry32, shuffle } from '@/engine/rng';
import type { Entity } from '@/engine/types';

/** Stable lists of at most 30 per series, mixed into at most 30 images total.
 * This is presentation only: the actual draw still uses the full eligible pool. */
export function previewPool(entities: readonly Entity[], active: readonly string[]): Entity[] {
  const groups = [...new Set(active)].sort().map((series) => shuffle(
    mulberry32(fnv1a32(`roulette:${series}`)),
    entities.filter((entity) => entity.image && entity.series.includes(series)).sort((a, b) => a.id.localeCompare(b.id)),
  ).slice(0, 30));
  const selected = new Map<string, Entity>();
  for (let index = 0; index < 30 && selected.size < 30; index++) {
    for (const group of groups) {
      const entity = group[index];
      if (entity) selected.set(entity.id, entity);
      if (selected.size === 30) break;
    }
  }
  return shuffle(mulberry32(fnv1a32(`roulette:${[...active].sort().join('.')}`)), [...selected.values()]);
}
