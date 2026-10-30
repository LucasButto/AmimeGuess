import type { AutocompleteItem } from '@/components/Autocomplete';
import { buildSearchIndex, search, type SearchIndex } from '@/components/search';

/** Valor del filtro «sin tipo secundario» (monotipo), el guion de la Pokédex. */
export const MONOTYPE_FILTER = '—';

export interface PokedexFilters {
  generations: readonly number[];
  types: readonly string[];
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

/**
 * Tipos: OR entre los elegidos (tipo 1 o tipo 2). El guion es un Y: con él activo solo quedan los de un único tipo.
 */
function typeMatches(attrs: AutocompleteItem['attrs'], types: readonly string[]): boolean {
  const others = types.filter((type) => type !== MONOTYPE_FILTER);
  const byType = others.length === 0 || [attrs?.tipo1, attrs?.tipo2].some((type) => typeof type === 'string' && others.includes(type));
  return byType && (!types.includes(MONOTYPE_FILTER) || (typeof attrs?.tipo1 === 'string' && !attrs?.tipo2));
}

/** OR dentro de cada faceta, AND entre facetas y búsqueda; nunca excluye los ya probados. */
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
    typeMatches(attrs, filters.types),
  ).sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
}
