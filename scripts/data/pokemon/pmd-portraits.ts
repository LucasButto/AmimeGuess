import { access } from 'node:fs/promises';
import path from 'node:path';
import type { Entity } from '../../../src/engine/types.ts';
import { portraitUrl, withPmdPortraits } from './pmd-core.ts';

/** Shared by the PMD command and the full Pokémon generator; never changes official image. */
export async function attachPmdPortraits(entities: readonly Entity[], root: string): Promise<Entity[]> {
  const available = new Set<number>();
  for (const entity of entities) {
    const number = entity.attrs.numero;
    if (typeof number !== 'number') continue;
    try {
      await access(path.join(root, 'public', portraitUrl(number)));
      available.add(number);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  return withPmdPortraits(entities, available);
}
