// Transformaciones puras del dataset de Yu-Gi-Oh: ids, enmascarado del nombre, lectura de la infobox
// de Yugipedia, respaldo de cada carta en las páginas del duelista y armado de entidades y
// contenidos. Sin red ni disco: lo que entra es lo ya descargado o curado; así se prueba con tests.

import type { Content, Entity } from '../../../src/engine/types.ts';
import {
  SERIES,
  SUMMONING,
  type DuelistSrc,
  type SeriesId,
  type SummoningKind,
  type Translations,
  type YgoprodeckCard,
} from './schemas.ts';

// --- Nombres e ids -----------------------------------------------------------

/** id estable en kebab-case a partir del nombre oficial en inglés: "Alligator's Sword" → "alligators-sword". */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** El texto de la carta con su propio nombre (en cualquiera de los que se pasan) reemplazado por "???". Sin distinguir mayúsculas. */
export function maskName(text: string, names: readonly string[]): string {
  const sorted = [...new Set(names.filter((name) => name.length > 0))].sort((a, b) => b.length - a.length);
  let masked = text;
  for (const name of sorted) masked = masked.replace(new RegExp(escapeRegExp(name), 'giu'), '???');
  return masked;
}

/** ¿Queda alguno de los nombres en el texto? Para comprobar que el enmascarado no dejó escapar la respuesta. */
export function leaksName(text: string, names: readonly string[]): boolean {
  const lower = text.toLowerCase();
  return names.some((name) => name.length > 0 && lower.includes(name.toLowerCase()));
}

// --- Infobox de Yugipedia ----------------------------------------------------

/** Los campos `| clave = valor` de la plantilla Infobox character de una página de Yugipedia. */
export function parseInfobox(wikitext: string): Record<string, string> {
  const start = wikitext.indexOf('{{Infobox character');
  if (start < 0) return {};
  let depth = 0;
  let end = wikitext.length;
  for (let index = start; index < wikitext.length - 1; index++) {
    if (wikitext.startsWith('{{', index)) {
      depth++;
      index++;
    } else if (wikitext.startsWith('}}', index)) {
      depth--;
      index++;
      if (depth === 0) {
        end = index + 1;
        break;
      }
    }
  }
  const fields: Record<string, string> = {};
  for (const part of wikitext.slice(start, end).split(/\n\|\s*/).slice(1)) {
    const match = part.match(/^([a-z0-9_]+)\s*=\s*([\s\S]*)$/i);
    if (match) fields[match[1]] = match[2].replace(/<ref[\s\S]*?(<\/ref>|\/>)/g, '').trim();
  }
  return fields;
}

/** Cómo llama Yugipedia a cada serie en la plantilla de episodio. */
export const YUGIPEDIA_SERIES_NAMES: Readonly<Record<SeriesId, string>> = {
  dm: 'Yu-Gi-Oh!',
  gx: 'Yu-Gi-Oh! GX',
  '5ds': "Yu-Gi-Oh! 5D's",
  zexal: 'Yu-Gi-Oh! ZEXAL',
  arcv: 'Yu-Gi-Oh! ARC-V',
  vrains: 'Yu-Gi-Oh! VRAINS',
};

export interface Debut {
  readonly series: SeriesId;
  readonly episode: number;
}

/**
 * La primera aparición en el anime que dice la infobox (`anime_debut = {{episode|Yu-Gi-Oh! GX|53|ref}}`). Si hay
 * varias entradas (un personaje que aparece con otro nombre antes), la de menor número. `null` si no hay ninguna.
 */
export function parseDebut(value: string | undefined): Debut | null {
  if (value === undefined) return null;
  const found: Debut[] = [];
  for (const match of value.matchAll(/\{\{episode\|([^|}]+)\|(\d+)/gi)) {
    const series = SERIES.find((id) => YUGIPEDIA_SERIES_NAMES[id] === match[1].trim());
    if (series !== undefined) found.push({ series, episode: Number(match[2]) });
  }
  if (found.length === 0) return null;
  return found.reduce((best, candidate) => (candidate.episode < best.episode ? candidate : best));
}

/** "GX, episodio 53": la pista "primera aparición" del Clásico. */
export function firstAppearanceText(debut: Debut, translations: Translations): string {
  return `${translations.series[debut.series]}, episodio ${debut.episode}`;
}

// --- Respaldo de cada carta en las páginas del duelista ----------------------

export interface PageLinks {
  /** Nombres (en minúsculas) que aparecen en las listas de deck de las páginas. */
  readonly deck: ReadonlySet<string>;
  /** Nombres (en minúsculas) que aparecen en cualquier lugar de las páginas. */
  readonly page: ReadonlySet<string>;
}

function linkNamesOf(text: string, into: Set<string>): void {
  for (const match of text.matchAll(/\[\[([^\]|#{}]+)(?:\|([^\]]*))?\]\]/g)) {
    const target = match[1].trim();
    if (target.includes(':')) continue;
    // Las listas enlazan a la versión de anime ("Elemental Hero Avian (anime)") y muestran el nombre real.
    const names = [target.replace(/\s*\((?:[^()]*)\)\s*$/, '').trim(), target];
    if (match[2] !== undefined) names.push(match[2].replace(/''/g, '').trim());
    for (const name of names) if (name.length > 0) into.add(name.toLowerCase());
  }
}

/** Los enlaces de un conjunto de páginas de Yugipedia, separando los de las listas de deck. */
export function pageLinks(wikitexts: readonly string[]): PageLinks {
  const deck = new Set<string>();
  const page = new Set<string>();
  for (const text of wikitexts) {
    for (const block of text.match(/\{\{Decklist[\s\S]*?\n\}\}/g) ?? []) linkNamesOf(block, deck);
    linkNamesOf(text, page);
  }
  return { deck, page };
}

export type Evidence = 'deck' | 'page' | 'none';

/** ¿Respalda alguna página del duelista que la carta es suya? `deck` es lo más firme; `none` hace fallar el build. */
export function evidenceOf(cardName: string, links: PageLinks): Evidence {
  const key = cardName.toLowerCase();
  if (links.deck.has(key)) return 'deck';
  return links.page.has(key) ? 'page' : 'none';
}

// --- Series y atributos de las cartas ----------------------------------------

export function orderSeries(ids: Iterable<SeriesId>): SeriesId[] {
  const set = new Set(ids);
  return SERIES.filter((id) => set.has(id));
}

export interface Owner {
  readonly id: string;
  readonly name: string;
  readonly series: readonly SeriesId[];
}

/** Un valor de un atributo de conjunto que lleva la serie de donde viene (regla 3 de la SPEC); sin serie si el duelista está en varias. */
function taggedBy(value: string, series: readonly SeriesId[]): { value: string; series?: string } {
  return series.length === 1 ? { value, series: series[0] } : { value };
}

function lookup(map: Readonly<Record<string, string>>, key: string, what: string): string {
  const value = map[key];
  if (value === undefined) throw new Error(`Falta traducir ${what} "${key}" en data-src/yugioh/translations.json`);
  return value;
}

export function isMonster(card: Pick<YgoprodeckCard, 'type'>): boolean {
  return card.type.includes('Monster');
}

/** Cómo se invoca una carta: `null` si no es un monstruo. Falla si el tipo no está en el diccionario. */
export function summoningOf(card: Pick<YgoprodeckCard, 'type'>, translations: Translations): SummoningKind | null {
  const entry = translations.cardType[card.type];
  if (entry === undefined) throw new Error(`Falta traducir el tipo de carta "${card.type}" en data-src/yugioh/translations.json`);
  return entry.summoning ?? null;
}

export interface CardInput {
  readonly id: string;
  readonly api: YgoprodeckCard;
  /** Nombre en español de YGOResources, o `null` si la carta no tiene clave `es`. */
  readonly spanishName: string | null;
  readonly owners: readonly Owner[];
  readonly image: string;
}

/** La entidad de una carta: sus datos de juego y los duelistas dueños. Hereda las series de sus dueños (regla 4). */
export function buildCardEntity(input: CardInput, translations: Translations): Entity {
  const { api } = input;
  const monster = isMonster(api);
  const clase = translations.cardType[api.type];
  if (clase === undefined) throw new Error(`Falta traducir el tipo de carta "${api.type}" en data-src/yugioh/translations.json`);
  const stat = (value: number | undefined) => (value !== undefined && value >= 0 ? value : null);
  const series = orderSeries(input.owners.flatMap((owner) => owner.series));
  const name = input.spanishName ?? api.name;
  return {
    id: input.id,
    name: { es: name, en: api.name },
    aliases: name === api.name ? [] : [api.name],
    series,
    image: input.image,
    attrs: {
      clase: clase.class,
      atributo: monster ? lookup(translations.attribute, api.attribute ?? '', 'el atributo') : lookup(translations.spellTrapAttribute, api.type, 'el tipo de carta'),
      tipo: monster ? lookup(translations.monsterType, api.race, 'el tipo de monstruo') : lookup(translations.spellTrapType, api.race, 'el tipo de mágica o trampa'),
      nivel: monster ? stat(api.type.includes('Link') ? api.linkval : api.level) : null,
      atk: monster ? stat(api.atk) : null,
      def: monster && !api.type.includes('Link') ? stat(api.def) : null,
      duelistas: input.owners.map((owner) => taggedBy(owner.name, owner.series)),
      serie: series.map((id) => ({ value: translations.series[id], series: id })),
      // El arte de una carta es un cuadro con fondo: no sirve para Silueta.
      imagenTransparente: 0,
    },
  };
}

export interface DuelistInput {
  readonly src: DuelistSrc;
  /** "Male" o "Female", de la infobox. */
  readonly gender: string;
  readonly debut: Debut;
  /** Cómo se invoca cada carta insignia del duelista (los monstruos): de ahí salen sus métodos de invocación. */
  readonly summoning: readonly SummoningKind[];
  readonly image: string | null;
  readonly transparent: boolean;
}

/** La entidad de un duelista. Serie de debut, primera aparición y género salen de las fuentes; el resto, de lo curado. */
export function buildDuelistEntity(input: DuelistInput, translations: Translations): Entity {
  const { src } = input;
  const used = new Set(input.summoning);
  return {
    id: src.id,
    name: { es: src.name },
    aliases: src.aliases,
    series: src.series,
    ...(input.image === null ? {} : { image: input.image }),
    attrs: {
      genero: lookup(translations.gender, input.gender, 'el género'),
      // Posición de la serie de debut en la lista canónica: se compara el número y se muestra el nombre.
      serieDebut: SERIES.indexOf(input.debut.series) + 1,
      rol: src.role,
      afiliaciones: src.affiliations,
      arquetipos: src.decks,
      metodosInvocacion: SUMMONING.filter((kind) => used.has(kind)).map((kind) => translations.summoning[kind]),
      primeraAparicion: firstAppearanceText(input.debut, translations),
      imagenTransparente: input.transparent ? 1 : 0,
    },
  };
}

// --- Contenidos ---------------------------------------------------------------

/** Un contenido por serie: es elegible si su serie está activa (regla 2), y la carta o el duelista lo es si alguna de las suyas lo está. */
function perSeries(prefix: string, owner: string, series: readonly SeriesId[], make: (series: SeriesId) => Omit<Content, 'id' | 'series'>): Content[] {
  return series.map((id) => ({ id: `${prefix}-${owner}-${id}`, series: id, ...make(id) }));
}

export function buildCardTextContents(cardId: string, series: readonly SeriesId[], text: string): Content[] {
  return perSeries('card-text', cardId, series, () => ({ kind: 'card-text', entityId: cardId, payload: { text }, verified: true }));
}

export interface DeckCard {
  readonly id: string;
  /** Nombre que se muestra: el de YGOResources, o el oficial en inglés si no tiene clave `es`. */
  readonly displayName: string;
  readonly iconicity: number;
  readonly ace: boolean;
}

/** Las cartas del deck de menor a mayor iconicidad, con la as al final: es lo que revela el modo Deck, una por fallo. */
export function orderDeck(cards: readonly DeckCard[]): DeckCard[] {
  return [...cards].sort((a, b) => a.iconicity - b.iconicity || Number(a.ace) - Number(b.ace) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function buildDeckContents(duelistId: string, series: readonly SeriesId[], cards: readonly DeckCard[]): Content[] {
  const items = orderDeck(cards).map((card) => card.displayName);
  return perSeries('deck', duelistId, series, () => ({ kind: 'deck', entityId: duelistId, payload: { items }, verified: false }));
}

export interface SummonInput {
  readonly cardId: string;
  readonly kind: 'fusion' | 'synchro' | 'xyz' | 'ritual';
  readonly series: readonly SeriesId[];
  /** Nombres que se muestran de los materiales, en orden. */
  readonly items: readonly string[];
  /** Ids de los materiales, en orden: dos monstruos con los mismos materiales se aceptan entre sí. */
  readonly materialIds: readonly string[];
}

/** Los monstruos que tienen exactamente los mismos materiales (sin importar el orden): la pista vale para todos. */
export function acceptedSummons(target: SummonInput, all: readonly SummonInput[]): string[] {
  const key = (input: SummonInput) => [...input.materialIds].sort().join('|');
  return all
    .filter((other) => other.cardId !== target.cardId && key(other) === key(target))
    .map((other) => other.cardId)
    .sort();
}

export function buildSummonContents(input: SummonInput, all: readonly SummonInput[]): Content[] {
  const accepts = acceptedSummons(input, all);
  return perSeries('summon', input.cardId, input.series, () => ({
    kind: 'summon',
    entityId: input.cardId,
    payload: { kind: input.kind, items: [...input.items], accepts },
    verified: false,
  }));
}

export function buildAceCardContents(
  duelistId: string,
  series: readonly SeriesId[],
  card: { id: string; image: string; width: number; height: number },
): Content[] {
  return perSeries('ace-card', duelistId, series, () => ({
    kind: 'ace-card',
    entityId: duelistId,
    payload: { image: card.image, width: card.width, height: card.height, card: card.id },
    verified: false,
  }));
}

// --- Materiales de una invocación -----------------------------------------------

/**
 * Los nombres entre comillas de la primera línea del texto de la carta, que es donde YGOPRODeck pone los
 * materiales de fusión y sincro ("Elemental HERO Avian" + "Elemental HERO Burstinatrix"). Sirve para comprobar
 * que los materiales curados son los que dice la carta.
 */
export function quotedMaterials(text: string): string[] {
  const firstLine = text.split('\n')[0] ?? '';
  return [...firstLine.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}
