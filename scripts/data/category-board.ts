import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { Entity } from '../../src/engine/types.ts';

const sourceSchema = z.object({
  verified: z.boolean(),
  sources: z.array(z.string()),
  rosterSize: z.number().int().positive(),
  roster: z.array(z.string()),
  exclusions: z.array(z.object({ series: z.string(), members: z.array(z.string()) }).strict()).optional(),
  categories: z.array(z.object({ id: z.string(), members: z.array(z.string()), requiresSeries: z.string().optional(), excludesSeries: z.string().optional(), replaces: z.string().optional() }).strict()).min(8),
}).strict();

/** El catálogo de Casillas se publica solo desde los generadores de datos. No modifica las entidades de otros modos. */
export async function buildCategoryBoard(root: string, franchise: string, entities: readonly Entity[]): Promise<void> {
  const source = sourceSchema.parse(JSON.parse(await readFile(path.join(root, 'data-src', franchise, 'casillas.json'), 'utf8')));
  const ids = new Set(entities.map((entity) => entity.id));
  if (source.roster.length !== source.rosterSize || new Set(source.roster).size !== source.rosterSize || source.roster.some((id) => !ids.has(id))) throw new Error(`${franchise}: catálogo de Casillas inválido`);
  if (new Set(source.categories.map((category) => category.id)).size !== source.categories.length) throw new Error(`${franchise}: categorías repetidas`);
  for (const category of source.categories) {
    if (new Set(category.members).size !== category.members.length || category.members.some((id) => !source.roster.includes(id))) throw new Error(`${franchise}: miembros inválidos en ${category.id}`);
  }
  const primaryCount = 8 + source.categories.filter((category) => category.replaces).length;
  for (const rule of source.exclusions ?? []) if (rule.members.some((id) => !source.roster.includes(id)) || new Set(rule.members).size !== rule.members.length) throw new Error(`${franchise}: exclusiones inválidas`);
  const uncovered = source.roster.filter((id) => !source.categories.slice(0, primaryCount).some((category) => category.members.includes(id)));
  if (uncovered.length) throw new Error(`${franchise}: personajes sin categoría principal: ${uncovered.join(', ')}`);
  await writeFile(path.join(root, 'data', franchise, 'casillas.json'), `${JSON.stringify(source, null, 2)}\n`);
}
