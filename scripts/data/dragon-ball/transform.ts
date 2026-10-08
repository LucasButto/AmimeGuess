// Lógica pura del build de Dragon Ball: sin red ni disco, para poder probarla.

import type { Content, Entity } from '../../../src/engine/types.ts';
import {
  SERIES,
  type CharacterSrc,
  type EventSrc,
  type PowerSrc,
  type SagasFile,
  type SeriesId,
  type TransformationSrc,
} from './schemas.ts';

// --- Series y orden cronológico ---------------------------------------------

/** Posición (desde 1) de cada serie en la cronología de la historia que define `data-src/dragon-ball/sagas.json`. */
export function seriesRanks(order: readonly SeriesId[]): Map<SeriesId, number> {
  if (new Set(order).size !== SERIES.length || SERIES.some((series) => !order.includes(series))) {
    throw new Error(`seriesOrder tiene que contener cada serie exactamente una vez (${SERIES.join(', ')}); es: ${order.join(', ')}`);
  }
  return new Map(order.map((series, index) => [series, index + 1]));
}

/**
 * Posición (desde 1) de cada saga en toda la cronología: primero por serie, y dentro
 * de ella en el orden en que están en el archivo.
 */
export function sagaRanks(file: SagasFile): Map<string, number> {
  const ranks = seriesRanks(file.seriesOrder);
  const ids = new Set<string>();
  for (const saga of file.sagas) {
    if (ids.has(saga.id)) throw new Error(`La saga ${saga.id} está repetida`);
    ids.add(saga.id);
  }
  const ordered = file.sagas
    .map((saga, index) => ({ saga, index }))
    .sort((a, b) => (ranks.get(a.saga.series) ?? 0) - (ranks.get(b.saga.series) ?? 0) || a.index - b.index);
  return new Map(ordered.map(({ saga }, index) => [saga.id, index + 1]));
}

/** Las series de la lista en orden canónico, sin repetir. */
export function canonicalSeries(series: Iterable<SeriesId>): SeriesId[] {
  const set = new Set(series);
  return SERIES.filter((id) => set.has(id));
}

/**
 * Las series en las que aparece una página de la wiki: las de las categorías
 * "Personajes de Dragon Ball / Z / GT / Super / Daima" que la contienen.
 */
export function seriesOfPage(title: string, members: Readonly<Record<SeriesId, ReadonlySet<string>>>): SeriesId[] {
  return SERIES.filter((series) => members[series].has(title));
}

/**
 * Serie de debut: la primera en orden canónico (el de emisión) entre las que aparece.
 * No es el orden de la cronología: un personaje que debutó en Super y sale en Daima
 * debutó en Super aunque Daima ocurra antes en la historia.
 */
export function debutSeries(series: readonly SeriesId[]): SeriesId {
  const first = canonicalSeries(series)[0];
  if (first === undefined) throw new Error('El personaje no aparece en ninguna serie');
  return first;
}

// --- Nombres que no se pueden ver en una pista ------------------------------

export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** ¿Aparece alguno de los nombres en el texto, como palabra o palabras completas? Ignora tildes, mayúsculas y signos. */
export function leaksName(text: string, names: readonly string[]): boolean {
  const haystack = ` ${normalize(text)} `;
  return names.some((name) => {
    const needle = normalize(name);
    return needle.length >= 3 && haystack.includes(` ${needle} `);
  });
}

// --- Entidades --------------------------------------------------------------

export interface EntityImage {
  /** Ruta dentro de /public/img sin tamaño ni extensión. */
  readonly path: string;
  /** ¿Es arte de fondo transparente? Solo esas sirven para Silueta. */
  readonly transparent: boolean;
}

function uniqueAliases(name: string, aliases: readonly string[]): string[] {
  const seen = new Set([normalize(name)]);
  const result: string[] = [];
  for (const alias of aliases) {
    const key = normalize(alias);
    if (key.length === 0 || seen.has(key)) continue;
    seen.add(key);
    result.push(alias);
  }
  return result;
}

export interface CharacterInput {
  readonly src: CharacterSrc;
  /** Series en las que aparece, en orden canónico. */
  readonly series: readonly SeriesId[];
  /** Posición cronológica de la serie de debut y de la saga de debut. */
  readonly debutSeriesRank: number;
  readonly debutSagaRank: number;
  readonly power: PowerSrc | undefined;
  readonly image: EntityImage | null;
}

/**
 * Un personaje. Los atributos de tipo conjunto son listas; los valores de `transformaciones` llevan
 * la serie en la que se ve la forma (regla 3). Lo que no se puede ordenar o no existe va como `null`.
 * `imagenTransparente` y `kiOficial` son 1 o 0 porque un atributo no puede ser un booleano.
 */
export function buildCharacterEntity(input: CharacterInput): Entity {
  const { src, series, power, image } = input;
  const entity: Entity = {
    id: src.id,
    name: { es: src.name },
    aliases: uniqueAliases(src.name, src.aliases),
    series: [...series],
    attrs: {
      genero: src.genero,
      razas: [...src.razas],
      afiliaciones: [...src.afiliaciones],
      planeta: src.planeta,
      transformaciones: src.transformaciones.map((item) => ({ value: item.value, series: item.series })),
      serieDebut: input.debutSeriesRank,
      sagaDebut: input.debutSagaRank,
      estadoVital: src.estadoVital,
      tecnica: src.tecnica,
      ki: power?.ki ?? null,
      kiOficial: power?.ki == null ? null : power.official ? 1 : 0,
      imagenTransparente: image === null ? null : image.transparent ? 1 : 0,
    },
  };
  if (image !== null) entity.image = image.path;
  return entity;
}

/** Una forma como entidad propia: lo que se adivina en el modo Transformación. */
export function buildTransformationEntity(src: TransformationSrc, characterName: string, image: EntityImage | null): Entity {
  const entity: Entity = {
    id: src.id,
    name: { es: src.name },
    aliases: uniqueAliases(src.name, src.aliases),
    series: [src.series],
    attrs: {
      personaje: characterName,
      forma: src.forma,
      imagenTransparente: image === null ? null : image.transparent ? 1 : 0,
    },
  };
  if (image !== null) entity.image = image.path;
  return entity;
}

// --- Contenidos -------------------------------------------------------------

/**
 * Lugar de cada suceso en la cronología de toda la franquicia, desde 1: primero por la serie
 * en la que ocurre (según `seriesOrder`) y después por su posición dentro de ella.
 */
export function eventOrders(events: readonly EventSrc[], seriesOrder: readonly SeriesId[]): Map<string, number> {
  const ranks = seriesRanks(seriesOrder);
  const seen = new Set<string>();
  for (const event of events) {
    const key = `${event.series}:${event.order}`;
    if (seen.has(key)) throw new Error(`Dos sucesos de ${event.series} tienen la misma posición (${event.order})`);
    seen.add(key);
  }
  const sorted = [...events].sort((a, b) => (ranks.get(a.series) ?? 0) - (ranks.get(b.series) ?? 0) || a.order - b.order);
  return new Map(sorted.map((event, index) => [event.id, index + 1]));
}

export function buildEventContent(event: EventSrc, order: number): Content {
  return { id: `event-${event.id}`, kind: 'event', series: event.series, payload: { text: event.text, order }, verified: event.verified };
}
