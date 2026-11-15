// Lógica pura del build de Dragon Ball: sin red ni disco, para poder probarla.

import type { Content, Entity } from '../../../src/engine/types.ts';
import {
  SERIES,
  type CharacterSrc,
  type EventSrc,
  type ConnectionGroupSrc,
  type SagasFile,
  type SeriesId,
} from './schemas.ts';

// --- Series y orden cronológico ---------------------------------------------

/** Posición (desde 1) de cada serie en la cronología de la historia que define `data/dragon-ball/source/sagas.json`. */
export function seriesRanks(order: readonly SeriesId[]): Map<SeriesId, number> {
  if (new Set(order).size !== SERIES.length || SERIES.some((series) => !order.includes(series))) {
    throw new Error(`seriesOrder tiene que contener cada serie exactamente una vez (${SERIES.join(', ')}); es: ${order.join(', ')}`);
  }
  return new Map(order.map((series, index) => [series, index + 1]));
}

/**
 * Posición (desde 1) de cada saga en toda la historia: manda el orden del arreglo
 * `sagas`, independientemente de su serie (el final de Z ocurre después de Super).
 */
export function sagaRanks(file: SagasFile): Map<string, number> {
  seriesRanks(file.seriesOrder);
  const ids = new Set<string>();
  for (const saga of file.sagas) {
    if (ids.has(saga.id)) throw new Error(`La saga ${saga.id} está repetida`);
    ids.add(saga.id);
  }
  return new Map(file.sagas.map((saga, index) => [saga.id, index + 1]));
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
  readonly image: EntityImage | null;
}

/**
 * Un personaje. Los atributos de tipo conjunto son listas; los valores de `transformaciones` llevan
 * la serie en la que se ve la forma (regla 3). Lo que no se puede ordenar o no existe va como `null`.
 * `imagenTransparente` es 1 o 0 porque un atributo no puede ser un booleano; `filler` y `mangaOnly` van con 1 solo si
 * corresponde (ver `withoutFlagged`).
 */
export function buildCharacterEntity(input: CharacterInput): Entity {
  const { src, series, image } = input;
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
      imagenTransparente: image === null ? null : image.transparent ? 1 : 0,
      ...(src.filler === true ? { filler: 1 } : {}),
      ...(src.mangaOnly === true ? { mangaOnly: 1 } : {}),
    },
  };
  if (image !== null) entity.image = image.path;
  return entity;
}

/**
 * Cuántos tableros distintos de Conexiones se pueden armar: uno por cada combinación de un grupo de cada dificultad
 * (1 a 4) en que cada grupo conserva al menos 4 miembros que no están en ninguno de los otros tres. `eligible`
 * limita los miembros (por ejemplo, a los de las series activas).
 */
export function countBoards(groups: readonly ConnectionGroupSrc[], eligible: (id: string) => boolean = () => true): number {
  const byDifficulty = [1, 2, 3, 4].map((level) => groups.filter((group) => group.difficulty === level));
  if (byDifficulty.some((list) => list.length === 0)) return 0;
  let count = 0;
  for (const a of byDifficulty[0]) {
    for (const b of byDifficulty[1]) {
      for (const c of byDifficulty[2]) {
        for (const d of byDifficulty[3]) {
          const chosen = [a, b, c, d];
          const valid = chosen.every((group) => {
            const others = chosen.filter((other) => other !== group);
            return group.members.filter((id) => eligible(id) && !others.some((other) => other.members.includes(id))).length >= 4;
          });
          if (valid) count++;
        }
      }
    }
  }
  return count;
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
  const payload = {
    text: event.text,
    order,
    ...(event.filler === true ? { filler: true as const } : {}),
    ...(event.mangaOnly === true ? { mangaOnly: true as const } : {}),
  };
  return { id: `event-${event.id}`, kind: 'event', series: event.series, payload, verified: event.verified };
}
