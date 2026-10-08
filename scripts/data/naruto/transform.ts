// Lógica pura del build de Naruto: sin red ni disco, para poder probarla.

import type { Content, Entity } from '../../../src/engine/types.ts';
import {
  SERIES,
  type ApiCharacter,
  type ArcsFile,
  type CharacterSrc,
  type EmojiSrc,
  type FocusSrc,
  type GroupSrc,
  type QuoteSrc,
  type SeriesId,
  type TeamSrc,
  type Translations,
} from './schemas.ts';

// --- Valores de las fuentes -------------------------------------------------

/** Un valor de la API como lista: la API a veces trae un texto y a veces un arreglo. */
export function asList(value: string | readonly string[] | undefined): string[] {
  if (value === undefined) return [];
  return typeof value === 'string' ? [value] : [...value];
}

/**
 * Un valor de la API sin ruido: espacios raros, notas entre paréntesis al final ("(Anime only)")
 * y los mensajes de error de la wiki que se cuelan en algunos campos
 * (`Ame Orphans"Ame Orphans" is not in the list…` queda como `Ame Orphans`). `null` si no queda nada.
 */
export function cleanValue(raw: string): string | null {
  let value = raw.replace(/[   ]/g, ' ');
  const error = value.indexOf('" is not in the list');
  if (error >= 0) value = value.slice(0, value.indexOf('"'));
  value = value.replace(/\s*\((?:Anime|Manga|Game|Movie|Novel|Databook|Boruto|Part|Affinity)[^)]*\)\s*$/i, '');
  value = value.replace(/\s+/g, ' ').trim();
  return value === '' ? null : value;
}

/** Los valores limpios, sin repetir y en el orden de la fuente. */
export function cleanList(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const value = cleanValue(raw);
    if (value === null || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

export interface Debut {
  readonly series: SeriesId;
  readonly episode: number;
}

const DEBUT_SERIES: ReadonlyArray<readonly [RegExp, SeriesId]> = [
  [/^Naruto Shipp[ūu]den\b/i, 'shippuden'],
  [/^Boruto\b/i, 'boruto'],
  [/^Naruto\b/i, 'naruto'],
];

/** Serie y episodio de `debut.anime` ("Naruto Shippūden Episode #128"). `null` si no hay episodio de anime. */
export function parseDebut(anime: string | undefined): Debut | null {
  if (anime === undefined) return null;
  const episode = /Episode\s+#(\d+)/i.exec(anime);
  if (episode === null) return null;
  const series = DEBUT_SERIES.find(([pattern]) => pattern.test(anime.trim()));
  return series === undefined ? null : { series: series[1], episode: Number(episode[1]) };
}

// --- Traducciones -----------------------------------------------------------

/**
 * La ocupación que se muestra de una lista de Dattebayo: la última sin ninguna nota entre paréntesis
 * (el orden de la lista va de lo viejo a lo reciente, y el punto 7 de la SPEC pide el estado en la última
 * serie). Si todas llevan nota, la última de las que son "ex" o "retirado"; las que son solo de un medio
 * ("Anime only") no cuentan, porque no son de la historia principal. `null` si no queda ninguna.
 */
export function pickOccupation(raws: readonly string[]): string | null {
  const plain = raws.filter((raw) => !/\(/.test(raw));
  if (plain.length > 0) return plain[plain.length - 1];
  const former = raws.filter((raw) => /\((?:former|retired)\)/i.test(raw));
  return former.length > 0 ? former[former.length - 1] : null;
}

export type DictionaryName = 'affiliation' | 'classification' | 'occupation' | 'kekkeiGenkai' | 'natureType' | 'jutsuType';

/**
 * Traduce una lista de valores de la API con el diccionario. Un valor con `null` en el diccionario se
 * ignora a propósito; uno que no está se devuelve en `unknown` para que el build falle con la lista completa.
 */
export function translateList(
  values: readonly string[],
  dictionary: Readonly<Record<string, string | null>>,
): { translated: string[]; unknown: string[] } {
  const translated: string[] = [];
  const unknown: string[] = [];
  for (const value of cleanList(values)) {
    if (!(value in dictionary)) {
      unknown.push(value);
      continue;
    }
    const target = dictionary[value];
    if (target !== null && !translated.includes(target)) translated.push(target);
  }
  return { translated, unknown };
}

// --- Tipos de jutsu ---------------------------------------------------------

/** Un usuario de la lista `users` de la infobox: lleva marcas ("game", "anime"…) si no es un usuario de la historia principal. */
export interface JutsuUser {
  readonly name: string;
  readonly tagged: boolean;
}

/** Los campos de una infobox de jutsu de Narutopedia que usa el build. */
export interface JutsuInfo {
  /** Valores de `jutsu classification`, sin las notas "~…". */
  readonly classification: string[];
  /** Nombre del archivo de la imagen (`image`), sin la leyenda que a veces trae detrás de un punto y coma. */
  readonly image: string | null;
  readonly users: JutsuUser[];
  /** Serie del primer episodio del anime en que sale (`debut anime`, `debut shippuden`, `boruto anime`). */
  readonly debutSeries: SeriesId | null;
}

function stripComments(text: string): string {
  return text.replace(/<!--[\s\S]*?-->/g, '');
}

function infoboxField(wikitext: string, field: string): string | null {
  const match = new RegExp(String.raw`\|\s*${field}\s*=([^\n]*)`, 'i').exec(wikitext);
  return match === null ? null : stripComments(match[1]).trim();
}

/** Lee la infobox de un jutsu (sección 0 de su página). */
export function parseJutsuInfo(wikitext: string): JutsuInfo {
  const classification = (infoboxField(wikitext, 'jutsu classification') ?? '')
    .split(',')
    .map((token) => token.split('~')[0].trim())
    .filter((token) => token.length > 0);
  const image = (infoboxField(wikitext, 'image') ?? '').split(';')[0].trim();
  const users = (infoboxField(wikitext, 'users') ?? '')
    .split(',')
    .map((token) => token.split('~'))
    .map(([name, ...tags]) => {
      // "Kiba Inuzuka~~with~Akamaru": lo que va desde "with" es el compañero de una técnica en pareja, no una marca de medio.
      const marks = tags.slice(0, tags.includes('with') ? tags.indexOf('with') : tags.length);
      return { name: name.trim(), tagged: marks.some((mark) => mark.trim() !== '') };
    })
    .filter((user) => user.name.length > 0);
  // `debut anime` es el número del episodio; `debut shippuden` y `boruto anime` dicen en qué serie está ese número.
  const episode = /^\d+/.test(infoboxField(wikitext, 'debut anime') ?? '');
  const flag = (field: string) => /^yes/i.test(infoboxField(wikitext, field) ?? '');
  const debutSeries: SeriesId | null = !episode ? null : flag('boruto anime') ? 'boruto' : flag('debut shippuden') ? 'shippuden' : 'naruto';
  return { classification, image: image === '' ? null : image, users, debutSeries };
}

/** Cuántos jutsu de un tipo hacen falta para que cuente como tipo del personaje: uno suelto (de un juego o una película) no. */
export const JUTSU_TYPE_THRESHOLD = 2;

/**
 * Los tipos de jutsu de un personaje: los tipos (ya traducidos) en que caen al menos
 * `JUTSU_TYPE_THRESHOLD` de sus jutsu. Orden estable: el del diccionario de tipos.
 */
export function jutsuTypesOf(typesPerJutsu: ReadonlyArray<readonly string[]>, order: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const types of typesPerJutsu) {
    for (const type of new Set(types)) counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return order.filter((type) => (counts.get(type) ?? 0) >= JUTSU_TYPE_THRESHOLD);
}

// --- Series y arcos ---------------------------------------------------------

/** Las series de la lista en orden canónico, sin repetir. */
export function canonicalSeries(series: Iterable<SeriesId>): SeriesId[] {
  const set = new Set(series);
  return SERIES.filter((id) => set.has(id));
}

/**
 * Posición (desde 1) de cada arco en toda la historia: primero por serie y dentro de ella por episodio
 * de inicio. Valida que los arcos de una serie empiecen en 1 y en orden creciente.
 */
export function arcRanks(arcs: ArcsFile): Map<string, number> {
  const ids = new Set<string>();
  for (const arc of arcs) {
    if (ids.has(arc.id)) throw new Error(`El arco ${arc.id} está repetido`);
    ids.add(arc.id);
  }
  const ordered: ArcsFile = [];
  for (const series of SERIES) {
    const own = arcs.filter((arc) => arc.series === series);
    if (own.length === 0) throw new Error(`No hay ningún arco de ${series}`);
    for (let index = 0; index < own.length; index++) {
      if (index === 0 && own[index].from !== 1) throw new Error(`El primer arco de ${series} (${own[index].id}) tiene que empezar en el episodio 1`);
      if (index > 0 && own[index].from <= own[index - 1].from) {
        throw new Error(`Los arcos de ${series} tienen que estar en orden de episodios: ${own[index - 1].id} (${own[index - 1].from}) y ${own[index].id} (${own[index].from})`);
      }
    }
    ordered.push(...own);
  }
  return new Map(ordered.map((arc, index) => [arc.id, index + 1]));
}

/** El arco al que pertenece un episodio del anime: el último que empezó en o antes de él. */
export function arcOfEpisode(arcs: ArcsFile, series: SeriesId, episode: number): string {
  const own = arcs.filter((arc) => arc.series === series).sort((a, b) => a.from - b.from);
  let found = own[0];
  for (const arc of own) if (arc.from <= episode) found = arc;
  if (found === undefined) throw new Error(`No hay arcos de ${series}`);
  return found.id;
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

/** Todos los nombres con que se puede reconocer a un personaje: el nombre, los alias y cada palabra de más de 3 letras del nombre. */
export function namesOf(character: Pick<CharacterSrc, 'name' | 'aliases'>): string[] {
  const words = character.name.split(/\s+/).filter((word) => normalize(word).length > 3);
  return [character.name, ...character.aliases, ...words];
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

export interface CharacterAttributes {
  readonly genero: string | null;
  readonly afiliaciones: readonly string[];
  readonly tiposDeJutsu: readonly string[];
  readonly kekkeiGenkai: readonly string[];
  readonly naturalezas: readonly string[];
  readonly atributos: readonly string[];
  readonly estadoVital: string;
  readonly ocupacion: string | null;
}

export interface CharacterInput {
  readonly src: CharacterSrc;
  readonly attributes: CharacterAttributes;
  /** Posición cronológica del arco de debut. */
  readonly arcRank: number;
  readonly translations: Pick<Translations, 'affiliationSeries'>;
  readonly image: EntityImage | null;
}

/**
 * Un personaje. Los atributos de tipo conjunto son listas (vacía = ninguno); las afiliaciones que solo se
 * conocen desde una serie llevan su etiqueta (regla 3). `imagenTransparente` es 1 o 0 (un atributo no puede
 * ser un booleano) y `null` mientras no haya imagen.
 */
export function buildCharacterEntity(input: CharacterInput): Entity {
  const { src, attributes, image } = input;
  const entity: Entity = {
    id: src.id,
    name: { es: src.name },
    aliases: uniqueAliases(src.name, src.aliases),
    series: canonicalSeries(src.series),
    attrs: {
      genero: attributes.genero,
      afiliaciones: attributes.afiliaciones.map((value) => {
        const series = input.translations.affiliationSeries[value];
        return series === undefined ? value : { value, series };
      }),
      tiposDeJutsu: [...attributes.tiposDeJutsu],
      kekkeiGenkai: [...attributes.kekkeiGenkai],
      naturalezas: [...attributes.naturalezas],
      atributos: [...attributes.atributos],
      arcoDebut: input.arcRank,
      estadoVital: attributes.estadoVital,
      ocupacion: attributes.ocupacion,
      imagenTransparente: image === null ? null : image.transparent ? 1 : 0,
    },
  };
  if (image !== null) entity.image = image.path;
  return entity;
}

/** Los atributos de un personaje a partir de la respuesta de Dattebayo, el diccionario y los tipos de jutsu; con lo forzado a mano por encima. */
export function deriveAttributes(
  src: CharacterSrc,
  api: ApiCharacter,
  translations: Translations,
  jutsuTypes: readonly string[],
): { attributes: CharacterAttributes; unknown: Array<{ field: DictionaryName | 'sex' | 'status'; value: string }> } {
  const unknown: Array<{ field: DictionaryName | 'sex' | 'status'; value: string }> = [];
  const personal = api.personal ?? {};
  const list = (field: DictionaryName, values: readonly string[]): string[] => {
    const result = translateList(values, translations[field]);
    for (const value of result.unknown) unknown.push({ field, value });
    return result.translated;
  };

  const sexRaw = personal.sex === undefined ? null : cleanValue(personal.sex);
  let genero: string | null = null;
  if (sexRaw !== null) {
    if (sexRaw in translations.sex) genero = translations.sex[sexRaw];
    else unknown.push({ field: 'sex', value: sexRaw });
  }
  const statusRaw = personal.status === undefined ? null : cleanValue(personal.status);
  let estadoVital: string = 'Vivo';
  if (statusRaw !== null) {
    if (statusRaw in translations.status) estadoVital = translations.status[statusRaw] ?? 'Vivo';
    else unknown.push({ field: 'status', value: statusRaw });
  }

  const occupationRaw = pickOccupation(asList(personal.occupation));
  const occupation = occupationRaw === null ? null : (list('occupation', [occupationRaw])[0] ?? null);

  const derived: CharacterAttributes = {
    genero,
    afiliaciones: list('affiliation', asList(personal.affiliation)),
    tiposDeJutsu: [...jutsuTypes],
    kekkeiGenkai: list('kekkeiGenkai', asList(personal.kekkeiGenkai)),
    naturalezas: list('natureType', api.natureType ?? []),
    atributos: list('classification', asList(personal.classification)),
    estadoVital,
    ocupacion: occupation,
  };
  const override = src.override ?? {};
  return {
    attributes: {
      genero: 'genero' in override ? (override.genero ?? null) : derived.genero,
      afiliaciones: override.afiliaciones ?? derived.afiliaciones,
      tiposDeJutsu: override.tiposDeJutsu ?? derived.tiposDeJutsu,
      kekkeiGenkai: override.kekkeiGenkai ?? derived.kekkeiGenkai,
      naturalezas: override.naturalezas ?? derived.naturalezas,
      atributos: override.atributos ?? derived.atributos,
      estadoVital: override.estadoVital ?? derived.estadoVital,
      ocupacion: 'ocupacion' in override ? (override.ocupacion ?? null) : derived.ocupacion,
    },
    unknown,
  };
}

// --- Contenidos -------------------------------------------------------------

export function buildQuoteContent(quote: QuoteSrc, arcName: string): Content {
  return {
    id: `quote-${quote.id}`,
    kind: 'quote',
    entityId: quote.character,
    series: quote.series,
    payload: {
      text: quote.text,
      source: quote.source,
      ...(quote.addressee === null ? {} : { addressee: quote.addressee }),
      arc: arcName,
    },
    verified: quote.verified,
  };
}

export function buildEmojiContent(item: EmojiSrc): Content {
  if (item.character !== undefined) {
    return { id: `emoji-${item.id}`, kind: 'emoji', entityId: item.character, series: item.series, payload: { text: item.text }, verified: item.verified };
  }
  return { id: `emoji-${item.id}`, kind: 'emoji-arc', series: item.series, payload: { arc: item.arc as string, text: item.text }, verified: item.verified };
}

/**
 * Todos los contenidos de equipo: uno por cada miembro que puede faltar. Los que se muestran son los demás
 * miembros, en el orden del equipo. Si lo que se muestra también cabe en otro equipo, los miembros de
 * ese otro que no se ven son respuestas válidas (`accepts`), porque la pista es igual de cierta.
 */
export function buildTeamContents(teams: readonly TeamSrc[], nameOf: (id: string) => string): Content[] {
  const contents: Content[] = [];
  for (const team of teams) {
    for (const missing of team.answers ?? team.members) {
      const shown = team.members.filter((id) => id !== missing);
      const accepts = new Set<string>();
      for (const other of teams) {
        if (other.id === team.id || !shown.every((id) => other.members.includes(id))) continue;
        for (const id of other.members) if (!shown.includes(id) && id !== missing) accepts.add(id);
      }
      contents.push({
        id: `team-${team.id}-${missing}`,
        kind: 'team',
        entityId: missing,
        series: team.series,
        payload: { team: team.name, items: shown.map(nameOf), accepts: [...accepts].sort() },
        verified: team.verified,
      });
    }
  }
  return contents;
}

export function buildEyeContents(focus: readonly FocusSrc[number][], seriesOf: (id: string) => SeriesId, hasImage: (id: string) => boolean): Content[] {
  return focus
    .filter((item) => hasImage(item.character))
    .map((item) => ({
      id: `eye-${item.character}`,
      kind: 'eye',
      entityId: item.character,
      series: seriesOf(item.character),
      payload: { image: `naruto/${item.character}`, width: 512, height: 512, focus: { x: item.x, y: item.y } },
      verified: item.verified,
    }));
}

/**
 * Quiénes están en más de un grupo, y en cuáles otros. Un tablero de Conexiones no puede mostrar a nadie que
 * pertenezca a dos de los grupos elegidos: con esto se sabe de un vistazo.
 */
export function sharedMembers(groups: readonly GroupSrc[]): Map<string, Map<string, string[]>> {
  const groupsOf = new Map<string, string[]>();
  for (const group of groups) {
    for (const member of group.members) {
      const list = groupsOf.get(member);
      if (list) list.push(group.id);
      else groupsOf.set(member, [group.id]);
    }
  }
  const result = new Map<string, Map<string, string[]>>();
  for (const group of groups) {
    const shared = new Map<string, string[]>();
    for (const member of group.members) {
      const others = (groupsOf.get(member) ?? []).filter((id) => id !== group.id);
      if (others.length > 0) shared.set(member, others);
    }
    result.set(group.id, shared);
  }
  return result;
}

export function buildGroupContent(group: GroupSrc, shared: ReadonlyMap<string, string[]>): Content {
  return {
    id: `group-${group.id}`,
    kind: 'group',
    series: group.series,
    payload: {
      name: group.name,
      category: group.category,
      difficulty: group.difficulty,
      members: [...group.members],
      shared: Object.fromEntries([...shared].sort(([a], [b]) => (a < b ? -1 : 1))),
    },
    verified: group.verified,
  };
}

/**
 * Cuántos tableros distintos se pueden armar: uno por cada combinación de un grupo de cada dificultad (1 a 4)
 * en que cada grupo conserva al menos 4 miembros que no están en ninguno de los otros tres.
 * `eligible` limita los miembros (por ejemplo, a los de las series activas).
 */
export function countBoards(groups: readonly GroupSrc[], eligible: (id: string) => boolean = () => true): number {
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
            const free = group.members.filter((id) => eligible(id) && !others.some((other) => other.members.includes(id)));
            return free.length >= 4;
          });
          if (valid) count++;
        }
      }
    }
  }
  return count;
}
