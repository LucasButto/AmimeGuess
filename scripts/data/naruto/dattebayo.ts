// Dattebayo API: los personajes del dataset por id y las listas de equipos, clanes, aldeas,
// kekkei genkai, Akatsuki y Kara. Se pide solo lo que entra al juego (nunca la lista completa de
// personajes); las listas de grupos son chicas (decenas de elementos) y se usan enteras.

import { DATTEBAYO, DATTEBAYO_BASE, getJson } from './api.ts';
import { apiCharacterSchema, apiGroupListSchema, apiMemberListSchema, type ApiCharacter } from './schemas.ts';
import { cleanValue } from './transform.ts';

export function fetchCharacter(id: number): Promise<ApiCharacter> {
  return getJson(`${DATTEBAYO_BASE}/characters/${id}`, apiCharacterSchema, DATTEBAYO);
}

/** Un grupo de Dattebayo con los ids de sus miembros. El nombre va limpio de notas ("(Anime only)"). */
export interface ApiGroup {
  readonly name: string;
  readonly characters: readonly number[];
}

const PAGE_SIZE = 100;

/** Las listas con miembros por id: `teams`, `clans`, `kekkei-genkai`, `villages`. Varias entradas pueden tener el mismo nombre limpio. */
export async function fetchGroups(key: 'teams' | 'clans' | 'kekkei-genkai' | 'villages'): Promise<ApiGroup[]> {
  const groups: ApiGroup[] = [];
  for (let page = 1; ; page++) {
    const result = await getJson(`${DATTEBAYO_BASE}/${key}?limit=${PAGE_SIZE}&page=${page}`, apiGroupListSchema(key), DATTEBAYO);
    const items = result[key];
    for (const item of items) groups.push({ name: cleanValue(item.name) ?? item.name, characters: item.characters });
    if (groups.length >= result.total || items.length === 0) return groups;
  }
}

/** Akatsuki y Kara: listas de personajes, de las que solo hace falta quiénes son. */
export async function fetchMembers(key: 'akatsuki' | 'kara'): Promise<number[]> {
  const ids: number[] = [];
  let seen = 0;
  for (let page = 1; ; page++) {
    const result = await getJson(`${DATTEBAYO_BASE}/${key}?limit=${PAGE_SIZE}&page=${page}`, apiMemberListSchema(key), DATTEBAYO);
    const items = result[key];
    ids.push(...items.map((item) => item.id));
    seen += items.length;
    if (seen >= result.total || items.length === 0) return ids;
  }
}
