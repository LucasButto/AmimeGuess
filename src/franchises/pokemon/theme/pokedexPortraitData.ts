import portraitIndex from '../../../../public/img/pokemon/pmd/index.json';
import type { AutocompleteItem } from '@/components/Autocomplete';

/** Retrato local normal o sad para un intento fallido, si está disponible en el manifiesto. */
export function pokedexPortraitUrl(item: Pick<AutocompleteItem, 'attrs'>, tried = false): string | undefined {
  const value = item.attrs?.pmdPortrait;
  if (typeof value !== 'string' || !/^\/img\/pokemon\/pmd\/\d{4}\/normal\.png$/.test(value)) return undefined;
  const number = value.split('/').at(-2)!;
  const portraits: Record<string, { sad: string | null }> = portraitIndex.portraits;
  return tried ? portraits[number]?.sad ?? value : value;
}

/** Native 40px artwork, scaled by whole integers within the reserved thumbnail slot. */
export function pokedexPortraitSize(width: number, height: number): number {
  return 40 * Math.max(1, Math.floor(Math.min(width, height) / 40));
}
