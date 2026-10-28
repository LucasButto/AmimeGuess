import type { AutocompleteItem } from '@/components/Autocomplete';
import { isTypeName, type TypeName } from './extras-art';

/** Tipo 1 antes de tipo 2; omite ausentes, desconocidos y repetidos. */
export function pokedexTypes(item: AutocompleteItem): TypeName[] {
  return [...new Set([item.attrs?.tipo1, item.attrs?.tipo2]
    .filter((value): value is TypeName => typeof value === 'string' && isTypeName(value)))];
}
