import type { AutocompleteItem } from '@/components/Autocomplete';
import { buildSearchIndex, search, type SearchIndex } from '@/components/search';

export const TYPE_MATCH_MODES = ['any', 'marked', 'exact'] as const;
export type TypeMatchMode = (typeof TYPE_MATCH_MODES)[number];

export interface PokedexFilters {
  generations: readonly number[];
  types: readonly string[];
  typeMatch?: TypeMatchMode;
}

export function availableGenerations(items: readonly AutocompleteItem[]): number[] {
  return [...new Set(items.flatMap(({ attrs }) =>
    typeof attrs?.generacion === 'number' ? [attrs.generacion] : [],
  ))].sort((a, b) => a - b);
}

export function availableTypes(items: readonly AutocompleteItem[]): string[] {
  return [...new Set(items.flatMap(({ attrs }) => [attrs?.tipo1, attrs?.tipo2]
    .filter((type): type is string => typeof type === 'string' && type.length > 0),
  ))].sort((a, b) => a.localeCompare(b, 'es'));
}

function typeMatches(attrs: AutocompleteItem['attrs'], chosen: readonly string[], mode: TypeMatchMode = 'any'): boolean {
  if (chosen.length === 0) return true;
  const actual = [attrs?.tipo1, attrs?.tipo2].filter((type): type is string => typeof type === 'string' && type.length > 0);
  if (mode === 'any') return actual.some((type) => chosen.includes(type));
  if (mode === 'exact' && actual.length !== chosen.length) return false;
  return actual.length > 0 && actual.every((type) => chosen.includes(type));
}

/** Combina las facetas con la búsqueda y conserva los Pokémon ya probados. */
export function filterByFacets(
  items: readonly AutocompleteItem[],
  filters: PokedexFilters,
  query = '',
  index: SearchIndex<AutocompleteItem> = buildSearchIndex(items),
): AutocompleteItem[] {
  const text = query.trim();
  const matches = text === '' ? items : /^\d+$/.test(text)
    ? items.filter((item) => item.number !== undefined && String(item.number).startsWith(String(Number(text))))
    : search(index, text);
  return matches.filter(({ attrs }) =>
    (filters.generations.length === 0 || (typeof attrs?.generacion === 'number' && filters.generations.includes(attrs.generacion))) &&
    typeMatches(attrs, filters.types, filters.typeMatch),
  ).sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
}
