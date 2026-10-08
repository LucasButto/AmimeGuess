// Cartas del TCG (sesión 05): qué cartas de TCGdex entran como contenido
// `tcg-card` de cada Pokémon. Es lógica pura salvo `pickCards`, que recibe de
// afuera cómo pedir el detalle y la imagen de una carta: así se prueba sin red.
//
// La elección no usa azar: ordena las candidatas de cada Pokémon por un hash de
// su id y toma las primeras que cumplen las reglas. Con las mismas respuestas de
// la API, el script siempre elige las mismas cartas.

import { fnv1a32 } from '../../../src/engine/hash.ts';
import type { Content, Entity } from '../../../src/engine/types.ts';
import type { TcgCard, TcgCardBrief } from './schemas.ts';

/** Cartas que entran por Pokémon (decisión de la sesión 05: 2, con calidad ~70, para quedar bajo los 150 MB). */
export const CARDS_PER_POKEMON = 2;

/** Carpeta de las cartas dentro de /public/img. */
export const CARD_DIRECTORY = 'pokemon/cards';

// TCGdex también trae las cartas digitales de TCG Pocket: sets "A1", "A1a", "A2b",
// "B1"… y promos "P-A", "P-B". Ningún set del juego de cartas físico tiene ese
// formato ("base1", "sv06", "swsh12", "svp"…). Las cartas del modo son del físico.
const POCKET_SET = /^(?:[AB]\d+[a-z]?|P-[A-Z])$/;

export function isPhysicalSet(setId: string): boolean {
  return !POCKET_SET.test(setId);
}

/** Id del set de una carta del listado: el id de la carta sin el `-<localId>` del final. */
export function setIdOf(card: Pick<TcgCardBrief, 'id' | 'localId'>): string {
  const suffix = `-${card.localId}`;
  return card.id.endsWith(suffix) ? card.id.slice(0, -suffix.length) : card.id;
}

function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** ¿Es una carta de Pokémon que muestra únicamente a esta especie? Descarta entrenadores, energías y cartas de equipo. */
export function isSinglePokemonCard(card: TcgCard, dex: number): boolean {
  return fold(card.category) === 'pokemon' && card.image !== undefined && card.dexId?.length === 1 && card.dexId[0] === dex;
}

/**
 * Candidatas de un Pokémon en el orden en que se prueban: solo las del juego
 * físico y con escaneo, ordenadas por un hash de `<pokemon>|<carta>`. El
 * desempate por id no cambia nada en la práctica, pero deja el orden definido.
 */
export function orderCandidates(entityId: string, briefs: readonly TcgCardBrief[]): TcgCardBrief[] {
  return briefs
    .filter((card) => card.image !== undefined && isPhysicalSet(setIdOf(card)))
    .map((card) => ({ card, key: fnv1a32(`${entityId}|${card.id}`) }))
    .sort((a, b) => a.key - b.key || (a.card.id < b.card.id ? -1 : a.card.id > b.card.id ? 1 : 0))
    .map(({ card }) => card);
}

/** De dónde sale el detalle y la imagen de una carta. Devuelven `null` si el recurso no existe (404). */
export interface CardSource {
  detail(id: string): Promise<TcgCard | null>;
  image(card: TcgCard): Promise<Buffer | null>;
}

export interface PickedCard {
  card: TcgCard;
  image: Buffer;
}

/**
 * Hasta `wanted` cartas de un Pokémon, de sets distintos (así no se repite la
 * misma ilustración reimpresa), que muestren solo a esa especie y tengan
 * imagen. Con menos candidatas válidas devuelve las que haya.
 */
export async function pickCards(
  entityId: string,
  dex: number,
  briefs: readonly TcgCardBrief[],
  source: CardSource,
  wanted: number = CARDS_PER_POKEMON,
): Promise<PickedCard[]> {
  const picked: PickedCard[] = [];
  const usedSets = new Set<string>();

  for (const brief of orderCandidates(entityId, briefs)) {
    if (picked.length >= wanted) break;
    if (usedSets.has(setIdOf(brief))) continue;

    const card = await source.detail(brief.id);
    if (card === null || !isSinglePokemonCard(card, dex)) continue;
    const image = await source.image(card);
    if (image === null) continue;

    picked.push({ card, image });
    usedSets.add(card.set.id);
  }
  return picked;
}

/** Nombre de archivo de una carta, sin tamaño ni extensión: minúsculas y solo letras, números y guiones. */
export function cardSlug(cardId: string): string {
  return cardId.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Ruta de la imagen dentro de /public/img, sin tamaño ni extensión: `pokemon/cards/sv06-108`. */
export function cardStem(cardId: string): string {
  return `${CARD_DIRECTORY}/${cardSlug(cardId)}`;
}

/**
 * La carta como contenido del Pokémon. `width` y `height` son las del archivo
 * de 512 px: sirven para reservar el espacio de la imagen antes de que cargue.
 * Viene tal cual de la API, sin redactar nada: por eso `verified: true`.
 */
export function buildCardContent(entity: Entity, card: TcgCard, size: { width: number; height: number }): Content {
  return {
    id: `tcg-card-${cardSlug(card.id)}`,
    kind: 'tcg-card',
    entityId: entity.id,
    series: entity.series[0],
    payload: { image: cardStem(card.id), width: size.width, height: size.height, cardId: card.id },
    verified: true,
  };
}
