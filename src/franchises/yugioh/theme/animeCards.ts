import type { Entity } from '@/engine/types';
import { es } from '@/i18n/es';

export type HiddenCardStat = 'nivel' | 'atk' | 'def';
const ATTRIBUTES: Readonly<Record<string, string>> = {
  OSCURIDAD: 'oscuridad', LUZ: 'luz', AGUA: 'agua', VIENTO: 'viento', TIERRA: 'tierra',
  FUEGO: 'fuego', MAGICA: 'magia', MAGIA: 'magia', TRAMPA: 'trampa', DIVINO: 'divino',
};

export function attributeIcon(value: unknown): string | undefined {
  const key = typeof value === 'string' ? value.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().trim() : '';
  const name = Object.hasOwn(ATTRIBUTES, key) ? ATTRIBUTES[key] : undefined;
  return name ? `/theme/yugioh/atributos/${name}.webp` : undefined;
}

export function cardNameKey(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/** No se usa para elegir respuestas; solo resuelve el nombre ya revelado por el motor. */
export function indexAnimeCards(cards: readonly Entity[]): ReadonlyMap<string, Entity> {
  const index = new Map<string, Entity>();
  for (const card of cards) {
    for (const key of [card.id, ...Object.values(card.name), ...(card.aliases ?? [])]) {
      if (typeof key === 'string') index.set(cardNameKey(key), card);
    }
  }
  return index;
}

export function numericCardValue(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('es-AR') : es.yugiohAnime.unknown;
}

let catalog: Promise<ReadonlyMap<string, Entity>> | undefined;
export function loadAnimeCards(): Promise<ReadonlyMap<string, Entity>> {
  return catalog ??= import('../../../../data/yugioh/cards.json')
    .then((data) => indexAnimeCards(data.default as Entity[]))
    .catch((error: unknown) => { catalog = undefined; throw error; });
}
