// npm run data:naruto
//
// Genera el dataset de Naruto (incluido Boruto) combinando lo curado a mano (data-src/naruto/)
// con lo que se puede sacar de las fuentes de la SPEC (sección 7):
//   data/naruto/entities.json   los personajes, con sus atributos del Clásico
//   data/naruto/content.json    frases, jutsus, equipos, emojis, puntos focales del ojo y grupos de Conexiones
//   data/naruto/arcs.json       series y arcos con su lugar en la historia
//   public/img/naruto/          imágenes en WebP, 256 y 512 px
//
// Qué sale de cada fuente:
//   - Dattebayo API: género, estado, afiliaciones, clasificación, kekkei genkai, naturalezas, ocupación,
//     la serie y el episodio de debut (`debut.anime`), las listas de jutsu y los equipos, clanes, aldeas,
//     kekkei genkai, Akatsuki y Kara con los que se comprueban los grupos y los equipos curados.
//   - Narutopedia (API MediaWiki): la infobox de cada jutsu (clasificación → tipos de jutsu, usuarios,
//     imagen, serie).
//   - data-src/: el resto (series en que aparece cada personaje, arcos, frases, equipos, emojis, grupos,
//     el diccionario inglés → español). Lo redactado va con `verified: false`.
// Las imágenes no se descargan: su CDN (static.wikia.nocookie.net) responde con un desafío de Cloudflare a
// los clientes que no son un navegador y no se intenta saltearlo. Se cargan a mano en
// data-src/naruto/images/ y quedan listadas en docs/CONTENT_TODO.md.
//
// Las respuestas de las APIs quedan en .cache/ (ignorada por git); la salida es determinista.
// Si algo no cumple (esquema, referencias, fuentes, imágenes), falla sin escribir los JSON.

import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { Content, Entity } from '../../../src/engine/types.ts';
import {
  SIZES,
  imageDimensions,
  imageFileName,
  readManualImage,
  renderEntityImage,
  renderPlainImage,
  type Rendered,
} from '../dragon-ball/images.ts';
import { ROOT, mapPool } from './api.ts';
import { fetchCharacter, fetchGroups, fetchMembers, type ApiGroup } from './dattebayo.ts';
import { printReport } from './report.ts';
import {
  SERIES,
  arcsFileSchema,
  arcsOutputSchema,
  characterEntitySchema,
  characterSrcSchema,
  contentSchema,
  emojiSrcSchema,
  focusSrcSchema,
  groupSrcSchema,
  jutsuSrcSchema,
  quoteSrcSchema,
  teamSrcSchema,
  translationsSchema,
  type ApiCharacter,
  type ArcsFile,
  type CharacterSrc,
  type EmojiSrc,
  type FocusSrc,
  type GroupSrc,
  type JutsuSrc,
  type QuoteSrc,
  type SeriesId,
  type TeamSrc,
  type Translations,
} from './schemas.ts';
import { renderTodoSection, writeTodoSection, type MissingImage } from './todo.ts';
import {
  arcOfEpisode,
  arcRanks,
  asList,
  buildCharacterEntity,
  buildEmojiContent,
  buildEyeContents,
  buildGroupContent,
  buildQuoteContent,
  buildTeamContents,
  cleanList,
  countBoards,
  deriveAttributes,
  jutsuTypesOf,
  leaksName,
  namesOf,
  normalize,
  parseDebut,
  sharedMembers,
  type EntityImage,
} from './transform.ts';
import { fetchJutsuInfos, jutsuTitles, pageUrl, type WikiJutsu } from './wiki.ts';

const SRC_DIR = path.join(ROOT, 'data-src', 'naruto');
const MANUAL_DIR = path.join(SRC_DIR, 'images');
const DATA_DIR = path.join(ROOT, 'data', 'naruto');
const IMG_ROOT = path.join(ROOT, 'public', 'img');
const IMAGE_DIR = path.join(IMG_ROOT, 'naruto');
const JUTSU_IMAGE_DIR = path.join(IMAGE_DIR, 'jutsus');
const TODO_FILE = path.join(ROOT, 'docs', 'CONTENT_TODO.md');

const IMAGE_TASKS = 4;
const IMG_LIMIT_BYTES = 150 * 1024 * 1024;
/** Pool mínimo de los modos con contenidos (SPEC 4, regla 6). */
const POOL_MINIMUM = 10;
/** Tableros distintos que tiene que poder armar Conexiones con todas las series activas (sesión 10). */
const BOARDS_MINIMUM = 30;

const started = Date.now();
const step = (message: string) => console.log(`[${((Date.now() - started) / 1000).toFixed(0).padStart(3)} s] ${message}`);

function fail(title: string, problems: string[]): never {
  const shown = problems.slice(0, 40).map((problem) => `  - ${problem}`);
  if (problems.length > shown.length) shown.push(`  … y ${problems.length - shown.length} más`);
  throw new Error(`${title} (${problems.length}):\n${shown.join('\n')}`);
}

function duplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) repeated.add(id);
    seen.add(id);
  }
  return [...repeated];
}

// --- 1. Lo curado a mano ----------------------------------------------------

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(path.join(SRC_DIR, file), 'utf8')) as unknown;
}

async function readSrc<T>(file: string, schema: z.ZodType<T>): Promise<T> {
  const parsed = schema.safeParse(await readJson(file));
  if (!parsed.success) {
    fail(
      `data-src/naruto/${file} no cumple el esquema`,
      parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  }
  return parsed.data;
}

interface Src {
  readonly arcs: ArcsFile;
  readonly translations: Translations;
  readonly characters: CharacterSrc[];
  readonly quotes: QuoteSrc[];
  readonly jutsus: JutsuSrc[];
  readonly teams: TeamSrc[];
  readonly emojis: EmojiSrc[];
  readonly groups: GroupSrc[];
  readonly focus: FocusSrc;
}

async function loadSrc(): Promise<Src> {
  return {
    arcs: await readSrc('arcs.json', arcsFileSchema),
    translations: await readSrc('translations.json', translationsSchema),
    characters: await readSrc('characters.json', z.array(characterSrcSchema)),
    quotes: await readSrc('quotes.json', z.array(quoteSrcSchema)),
    jutsus: await readSrc('jutsus.json', z.array(jutsuSrcSchema)),
    teams: await readSrc('teams.json', z.array(teamSrcSchema)),
    emojis: await readSrc('emojis.json', z.array(emojiSrcSchema)),
    groups: await readSrc('groups.json', z.array(groupSrcSchema)),
    focus: await readSrc('focus.json', focusSrcSchema),
  };
}

/** Referencias cruzadas entre los archivos curados (lo que no necesita las fuentes). */
function checkSrc(src: Src): void {
  const problems: string[] = [];
  const characterById = new Map(src.characters.map((character) => [character.id, character]));
  const arcById = new Map(src.arcs.map((arc) => [arc.id, arc]));
  const has = (id: string) => characterById.has(id);

  for (const [file, ids] of [
    ['characters.json', src.characters.map((item) => item.id)],
    ['quotes.json', src.quotes.map((item) => item.id)],
    ['jutsus.json', src.jutsus.map((item) => item.id)],
    ['teams.json', src.teams.map((item) => item.id)],
    ['emojis.json', src.emojis.map((item) => item.id)],
    ['groups.json', src.groups.map((item) => item.id)],
  ] as const) {
    for (const id of duplicates(ids)) problems.push(`${file}: el id ${id} está repetido`);
  }
  for (const api of duplicates(src.characters.map((character) => String(character.api)))) {
    problems.push(`characters.json: dos personajes usan el mismo id de Dattebayo (${api})`);
  }

  for (const character of src.characters) {
    const ordered = SERIES.filter((series) => character.series.includes(series));
    if (ordered.join() !== character.series.join()) problems.push(`${character.id}: sus series tienen que ser únicas y estar en orden canónico (${SERIES.join(', ')})`);
    if (character.arcDebut !== undefined) {
      const arc = arcById.get(character.arcDebut);
      if (arc === undefined) problems.push(`${character.id}: el arco de debut ${character.arcDebut} no existe en arcs.json`);
      else if (arc.series !== character.series[0]) problems.push(`${character.id}: su arco de debut es de ${arc.series} pero debuta en ${character.series[0]}`);
    }
  }

  for (const quote of src.quotes) {
    const character = characterById.get(quote.character);
    if (character === undefined) {
      problems.push(`quotes.json: ${quote.id} apunta al personaje inexistente ${quote.character}`);
      continue;
    }
    if (!character.series.includes(quote.series)) problems.push(`quotes.json: ${quote.id} es de ${quote.series}, que ${character.id} no tiene`);
    const arc = arcById.get(quote.arc);
    if (arc === undefined) problems.push(`quotes.json: ${quote.id} dice el arco inexistente ${quote.arc}`);
    else if (arc.series !== quote.series) problems.push(`quotes.json: ${quote.id} es de ${quote.series} pero su arco ${arc.id} es de ${arc.series}`);
    if (leaksName(quote.text, namesOf(character))) problems.push(`quotes.json: ${quote.id} dice el nombre de ${character.name}`);
    for (const other of quote.accepts ?? []) {
      if (!has(other)) problems.push(`quotes.json: ${quote.id} acepta al personaje inexistente ${other}`);
      if (other === quote.character) problems.push(`quotes.json: ${quote.id} se acepta a sí misma`);
    }
  }

  for (const jutsu of src.jutsus) {
    const answer = characterById.get(jutsu.answer);
    if (answer === undefined) problems.push(`jutsus.json: ${jutsu.id} apunta al personaje inexistente ${jutsu.answer}`);
    else if (jutsu.series !== undefined && !answer.series.includes(jutsu.series)) problems.push(`jutsus.json: ${jutsu.id} es de ${jutsu.series}, que ${answer.id} no tiene`);
  }

  for (const team of src.teams) {
    for (const member of team.members) {
      const character = characterById.get(member);
      if (character === undefined) problems.push(`teams.json: ${team.id} nombra al personaje inexistente ${member}`);
      else if (!character.series.includes(team.series)) problems.push(`teams.json: ${team.id} es de ${team.series}, que ${member} no tiene`);
    }
    if (new Set(team.members).size !== team.members.length) problems.push(`teams.json: ${team.id} repite miembros`);
    for (const answer of team.answers ?? []) {
      if (!team.members.includes(answer)) problems.push(`teams.json: ${team.id} permite faltar a ${answer}, que no es miembro`);
    }
  }

  for (const item of src.emojis) {
    if (item.character !== undefined) {
      const character = characterById.get(item.character);
      if (character === undefined) problems.push(`emojis.json: ${item.id} apunta al personaje inexistente ${item.character}`);
      else if (!character.series.includes(item.series)) problems.push(`emojis.json: ${item.id} es de ${item.series}, que ${character.id} no tiene`);
    } else {
      const arc = arcById.get(item.arc as string);
      if (arc === undefined) problems.push(`emojis.json: ${item.id} apunta al arco inexistente ${String(item.arc)}`);
      else if (arc.series !== item.series) problems.push(`emojis.json: ${item.id} es de ${item.series} pero su arco es de ${arc.series}`);
    }
  }
  for (const id of duplicates(src.emojis.flatMap((item) => (item.character === undefined ? [] : [item.character])))) {
    problems.push(`emojis.json: el personaje ${id} tiene más de una secuencia`);
  }

  for (const group of src.groups) {
    for (const member of group.members) {
      if (!has(member)) problems.push(`groups.json: ${group.id} nombra al personaje inexistente ${member}`);
    }
    if (new Set(group.members).size !== group.members.length) problems.push(`groups.json: ${group.id} repite miembros`);
  }
  for (const level of [1, 2, 3, 4]) {
    if (!src.groups.some((group) => group.difficulty === level)) problems.push(`groups.json: no hay ningún grupo de dificultad ${level}`);
  }

  for (const item of src.focus) {
    if (!has(item.character)) problems.push(`focus.json: apunta al personaje inexistente ${item.character}`);
  }
  for (const id of duplicates(src.focus.map((item) => item.character))) problems.push(`focus.json: el personaje ${id} tiene dos puntos`);

  if (problems.length > 0) fail('Los archivos de data-src/naruto/ no son coherentes', problems);
}

// --- 2. Imágenes ------------------------------------------------------------

interface EntityImageResult {
  readonly image: EntityImage | null;
  readonly rendered: Rendered[];
}

/** La imagen de un personaje: solo la cargada a mano (las de las fuentes no se pueden descargar). */
async function characterImage(id: string): Promise<EntityImageResult> {
  const manual = await readManualImage(path.join(MANUAL_DIR, 'characters'), id);
  if (manual === null) return { image: null, rendered: [] };
  try {
    const { rendered, transparent } = await renderEntityImage(id, manual.buffer, IMAGE_DIR);
    return { image: { path: `naruto/${id}`, transparent }, rendered };
  } catch (error) {
    throw new Error(`Imagen de ${id}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// --- 3. Validación de la salida ---------------------------------------------

async function checkImageFile(file: string, expected: number, budget: number, label: string): Promise<string[]> {
  try {
    const [{ size: bytes }, dimensions] = await Promise.all([stat(file), imageDimensions(file)]);
    const found: string[] = [];
    if (dimensions.format !== 'webp') found.push(`${label}: no es WebP`);
    if (Math.max(dimensions.width, dimensions.height) !== expected) found.push(`${label}: mide ${dimensions.width}×${dimensions.height}`);
    if (bytes > budget) found.push(`${label}: pesa ${bytes} bytes`);
    return found;
  } catch {
    return [`${label}: falta el archivo`];
  }
}

const BUDGET: Record<256 | 512, number> = { 256: 25 * 1024, 512: 70 * 1024 };

async function validate(characters: Entity[], contents: Content[], groups: readonly GroupSrc[]): Promise<void> {
  const problems: string[] = [];

  characters.forEach((entity) => {
    const result = characterEntitySchema.safeParse(entity);
    if (!result.success) problems.push(`personaje ${entity.id}: ${result.error.message}`);
  });
  contents.forEach((content) => {
    const result = contentSchema.safeParse(content);
    if (!result.success) problems.push(`contenido ${content.id}: ${result.error.message}`);
  });

  for (const id of duplicates(characters.map((entity) => entity.id))) problems.push(`hay dos personajes con el id ${id}`);
  for (const id of duplicates(contents.map((content) => content.id))) problems.push(`hay dos contenidos con el id ${id}`);

  // Referencias: un contenido no puede apuntar a un personaje que no existe.
  const characterIds = new Set(characters.map((entity) => entity.id));
  for (const content of contents) {
    if (content.entityId !== undefined && !characterIds.has(content.entityId)) {
      problems.push(`el contenido ${content.id} apunta a un personaje inexistente (${content.entityId})`);
    }
    for (const key of ['accepts', 'members'] as const) {
      const value = content.payload[key];
      if (!Array.isArray(value)) continue;
      for (const other of value as string[]) {
        if (!characterIds.has(other)) problems.push(`${content.id}: ${key} nombra a ${other}, que no existe`);
      }
    }
    if (Array.isArray(content.payload.accepts) && content.entityId !== undefined && (content.payload.accepts as string[]).includes(content.entityId)) {
      problems.push(`${content.id}: se acepta a sí mismo`);
    }
  }

  // Cada serie tiene algo.
  for (const series of SERIES) {
    if (!characters.some((entity) => entity.series.includes(series))) problems.push(`no hay ningún personaje de ${series}`);
  }
  if (countBoards(groups) < BOARDS_MINIMUM) {
    problems.push(`con todas las series activas solo se pueden armar ${countBoards(groups)} tableros de Conexiones distintos, y hacen falta ${BOARDS_MINIMUM}`);
  }

  // Imágenes en disco: las dos variantes, WebP, lado mayor exacto y dentro del presupuesto.
  const imageChecks = await mapPool(characters, 8, async (entity) => {
    if (entity.image === undefined) return [];
    const found: string[] = [];
    if (entity.image !== `naruto/${entity.id}`) found.push(`${entity.id}: ruta de imagen inesperada (${entity.image})`);
    for (const size of SIZES) {
      found.push(...(await checkImageFile(path.join(IMAGE_DIR, imageFileName(entity.id, size)), size, BUDGET[size], `${entity.id} (${size} px)`)));
    }
    return found;
  });
  problems.push(...imageChecks.flat());

  const jutsuChecks = await mapPool(
    contents.filter((content) => content.kind === 'jutsu'),
    8,
    async (content) => {
      const found: string[] = [];
      const id = content.id.replace(/^jutsu-/, '');
      for (const size of SIZES) {
        found.push(...(await checkImageFile(path.join(JUTSU_IMAGE_DIR, imageFileName(id, size)), size, BUDGET[size], `${content.id} (${size} px)`)));
      }
      const dimensions = await imageDimensions(path.join(JUTSU_IMAGE_DIR, imageFileName(id, 512)));
      if (dimensions.width !== content.payload.width || dimensions.height !== content.payload.height) {
        found.push(`${content.id}: el contenido dice ${String(content.payload.width)}×${String(content.payload.height)} y el archivo mide ${dimensions.width}×${dimensions.height}`);
      }
      return found;
    },
  );
  problems.push(...jutsuChecks.flat());

  if (problems.length > 0) fail('Los datos generados no cumplen', problems);
}

// --- 4. Escritura -----------------------------------------------------------

async function writeJson(file: string, value: unknown): Promise<void> {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  try {
    if ((await readFile(file, 'utf8')) === text) return;
  } catch {
    // No existe todavía.
  }
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text);
}

async function directoryBytes(directory: string): Promise<number> {
  let total = 0;
  for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
    const entryPath = path.join(directory, entry.name);
    total += entry.isDirectory() ? await directoryBytes(entryPath) : (await stat(entryPath)).size;
  }
  return total;
}

// --- 5. Grupos y equipos contra las fuentes ---------------------------------

interface GroupSources {
  readonly villages: readonly ApiGroup[];
  readonly clans: readonly ApiGroup[];
  readonly kekkeiGenkai: readonly ApiGroup[];
  readonly akatsuki: ReadonlySet<number>;
  readonly kara: ReadonlySet<number>;
  /** Por valor de `classification` de Dattebayo (limpio), los ids del juego que lo tienen. */
  readonly classification: ReadonlyMap<string, ReadonlySet<string>>;
  readonly idOfApi: ReadonlyMap<number, string>;
}

/** Los personajes del juego que una fuente de Dattebayo pone en el grupo. */
function derivedMembers(group: GroupSrc, sources: GroupSources): Set<string> | string {
  const derived = group.derived;
  if (derived === undefined) return new Set();
  const fromApiIds = (ids: Iterable<number>) => new Set([...ids].flatMap((id) => (sources.idOfApi.has(id) ? [sources.idOfApi.get(id) as string] : [])));
  const named = (list: readonly ApiGroup[]) => {
    const matching = list.filter((item) => item.name === derived.name);
    if (matching.length === 0) return `no hay un grupo "${String(derived.name)}" en Dattebayo (${derived.from})`;
    return fromApiIds(matching.flatMap((item) => item.characters));
  };
  switch (derived.from) {
    case 'village':
      return named(sources.villages);
    case 'clan':
      return named(sources.clans);
    case 'kekkei-genkai':
      return named(sources.kekkeiGenkai);
    case 'akatsuki':
      return fromApiIds(sources.akatsuki);
    case 'kara':
      return fromApiIds(sources.kara);
    case 'classification':
      return new Set(sources.classification.get(derived.name ?? '') ?? []);
  }
}

function checkGroups(groups: readonly GroupSrc[], sources: GroupSources): void {
  const problems: string[] = [];
  for (const group of groups) {
    if (group.derived === undefined) continue;
    const found = derivedMembers(group, sources);
    if (typeof found === 'string') {
      problems.push(`${group.id}: ${found}`);
      continue;
    }
    const expected = new Set([...found, ...(group.derived.include ?? [])]);
    for (const id of group.derived.exclude ?? []) expected.delete(id);
    const missing = [...expected].filter((id) => !group.members.includes(id));
    const extra = group.members.filter((id) => !expected.has(id));
    if (missing.length > 0) problems.push(`${group.id}: Dattebayo pone en el grupo a ${missing.join(', ')} y la lista no (agregarlos, o ponerlos en derived.exclude)`);
    if (extra.length > 0) problems.push(`${group.id}: la lista tiene a ${extra.join(', ')} y Dattebayo no (quitarlos, o ponerlos en derived.include)`);
  }
  if (problems.length > 0) fail('Los grupos de data-src/naruto/groups.json no coinciden con Dattebayo', problems);
}

/** Cada miembro curado de un equipo tiene que estar en ese equipo según Dattebayo; devuelve los que Dattebayo suma y el equipo curado no. */
function checkTeams(teams: readonly TeamSrc[], characters: readonly CharacterSrc[], apiTeams: readonly ApiGroup[]): string[] {
  const problems: string[] = [];
  const hints: string[] = [];
  const byId = new Map(characters.map((character) => [character.id, character]));
  const idOfApi = new Map(characters.map((character) => [character.api, character.id]));
  for (const team of teams) {
    if (team.api === undefined) continue;
    const matching = apiTeams.filter((item) => item.name === team.api);
    if (matching.length === 0) {
      problems.push(`${team.id}: no hay un equipo "${team.api}" en Dattebayo`);
      continue;
    }
    const apiIds = new Set(matching.flatMap((item) => item.characters));
    for (const member of team.members) {
      const character = byId.get(member) as CharacterSrc;
      if (!apiIds.has(character.api)) problems.push(`${team.id}: Dattebayo no pone a ${member} en el equipo "${team.api}"`);
    }
    const extra = [...apiIds].flatMap((id) => (idOfApi.has(id) && !team.members.includes(idOfApi.get(id) as string) ? [idOfApi.get(id) as string] : []));
    if (extra.length > 0) hints.push(`${team.name}: ${extra.join(', ')}`);
  }
  if (problems.length > 0) fail('Los equipos de data-src/naruto/teams.json no coinciden con Dattebayo', problems);
  return hints;
}

// --- Programa ---------------------------------------------------------------

async function main(): Promise<void> {
  step('Leyendo data-src/naruto/…');
  const src = await loadSrc();
  checkSrc(src);
  const arcRank = arcRanks(src.arcs);

  step(`Dattebayo API: ${src.characters.length} personajes…`);
  const apis: ApiCharacter[] = await mapPool(src.characters, 5, (character) => fetchCharacter(character.api));
  const sourceProblems: string[] = [];
  src.characters.forEach((character, index) => {
    if (apis[index].name !== character.apiName) sourceProblems.push(`${character.id}: el id ${character.api} ahora es "${apis[index].name}" y se curó como "${character.apiName}"`);
  });
  if (sourceProblems.length > 0) fail('Lo curado ya no coincide con Dattebayo', sourceProblems);

  step('Dattebayo API: equipos, clanes, aldeas, kekkei genkai, Akatsuki y Kara…');
  const [apiTeams, clans, villages, kekkeiGenkai, akatsuki, kara] = await Promise.all([
    fetchGroups('teams'),
    fetchGroups('clans'),
    fetchGroups('villages'),
    fetchGroups('kekkei-genkai'),
    fetchMembers('akatsuki'),
    fetchMembers('kara'),
  ]);
  const classification = new Map<string, Set<string>>();
  src.characters.forEach((character, index) => {
    for (const value of cleanList(asList(apis[index].personal?.classification))) {
      const set = classification.get(value) ?? new Set<string>();
      set.add(character.id);
      classification.set(value, set);
    }
  });
  checkGroups(src.groups, {
    villages,
    clans,
    kekkeiGenkai,
    akatsuki: new Set(akatsuki),
    kara: new Set(kara),
    classification,
    idOfApi: new Map(src.characters.map((character) => [character.api, character.id])),
  });
  const teamHints = checkTeams(src.teams, src.characters, apiTeams);

  // Jutsus: la infobox de cada jutsu de los personajes y de los curados
  const titles = jutsuTitles([...apis.flatMap((api) => api.jutsu ?? []), ...src.jutsus.map((jutsu) => jutsu.wiki)]);
  step(`Narutopedia: infobox de ${titles.length} jutsus (de a 50 por solicitud)…`);
  const infos = await fetchJutsuInfos(titles);
  const resolvedJutsu = [...infos.values()].filter((info) => info !== null).length;
  const jutsuTypeOrder = [...new Set(Object.values(src.translations.jutsuType).filter((value): value is string => value !== null))];
  const typesOf = (info: WikiJutsu): string[] => info.classification.flatMap((token) => src.translations.jutsuType[token] ?? []);

  // Series, arcos y atributos
  step('Armando personajes…');
  const problems: string[] = [];
  const unknownValues = new Map<string, Set<string>>();
  const characterImages = await mapPool(src.characters, IMAGE_TASKS, (character) => characterImage(character.id));
  const characters: Entity[] = src.characters.map((character, index) => {
    const api = apis[index];
    const debut = parseDebut(api.debut?.anime);
    let arcId = character.arcDebut;
    if (debut !== null) {
      if (debut.series !== character.series[0]) {
        problems.push(`${character.id}: Dattebayo dice que debuta en ${debut.series} (${api.debut?.anime ?? ''}) y su primera serie es ${character.series[0]}`);
      }
      arcId ??= arcOfEpisode(src.arcs, debut.series, debut.episode);
    } else if (arcId === undefined) {
      problems.push(`${character.id}: Dattebayo no tiene episodio de anime de debut; hay que indicar "arcDebut" en characters.json`);
    }

    const typesPerJutsu = cleanList(api.jutsu ?? []).flatMap((title) => {
      const info = infos.get(title);
      return info === undefined || info === null ? [] : [typesOf(info)];
    });
    const { attributes, unknown } = deriveAttributes(character, api, src.translations, jutsuTypesOf(typesPerJutsu, jutsuTypeOrder));
    for (const item of unknown) {
      const set = unknownValues.get(item.field) ?? new Set<string>();
      set.add(item.value);
      unknownValues.set(item.field, set);
    }
    return buildCharacterEntity({
      src: character,
      attributes,
      arcRank: arcRank.get(arcId ?? '') ?? 0,
      translations: src.translations,
      image: characterImages[index].image,
    });
  });
  if (problems.length > 0) fail('Los personajes no coinciden con Dattebayo', problems);
  if (unknownValues.size > 0) {
    fail(
      'Valores de Dattebayo que no están en data-src/naruto/translations.json (agregarlos con su traducción, o con null para ignorarlos)',
      [...unknownValues].map(([field, values]) => `${field}: ${[...values].map((value) => JSON.stringify(value)).join(', ')}`),
    );
  }

  // Contenidos
  step('Armando contenidos…');
  const characterById = new Map(src.characters.map((character) => [character.id, character]));
  const nameById = (id: string) => (characterById.get(id) as CharacterSrc).name;
  const arcName = new Map(src.arcs.map((arc) => [arc.id, arc.name]));
  const seriesOf = (id: string) => (characterById.get(id) as CharacterSrc).series[0];

  const wikiTitleOf = (character: CharacterSrc) => character.wiki ?? character.apiName;
  const idByName = new Map<string, string>();
  for (const character of src.characters) {
    idByName.set(normalize(wikiTitleOf(character)), character.id);
    idByName.set(normalize(character.name), character.id);
  }

  const quotes: Content[] = src.quotes.map((quote) => {
    const content = buildQuoteContent(quote, arcName.get(quote.arc) as string);
    const source = quote.source ?? pageUrl(wikiTitleOf(characterById.get(quote.character) as CharacterSrc));
    const payload: Record<string, unknown> = { ...content.payload, source };
    if (quote.accepts !== undefined && quote.accepts.length > 0) payload.accepts = [...quote.accepts];
    return { ...content, payload };
  });
  const teams = buildTeamContents(src.teams, nameById);
  const emojis = src.emojis.map(buildEmojiContent);
  const eyes = buildEyeContents(src.focus, seriesOf, (id) => characters.find((entity) => entity.id === id)?.image !== undefined);
  const shared = sharedMembers(src.groups);
  const groups = src.groups.map((group) => buildGroupContent(group, shared.get(group.id) ?? new Map()));

  // Jutsus: la infobox dice quién más los usa, y de qué serie son; la imagen sale de la carga manual
  step(`Imágenes de ${src.jutsus.length} jutsus (solo las cargadas a mano)…`);
  const jutsuProblems: string[] = [];
  const jutsuImages = await mapPool(src.jutsus, IMAGE_TASKS, async (jutsu) => {
    const manual = await readManualImage(path.join(MANUAL_DIR, 'jutsus'), jutsu.id);
    if (manual === null) return null;
    const rendered = await renderPlainImage(jutsu.id, manual.buffer, JUTSU_IMAGE_DIR);
    const size = await imageDimensions(path.join(JUTSU_IMAGE_DIR, imageFileName(jutsu.id, 512)));
    return { rendered, width: size.width, height: size.height };
  });
  const jutsuContents: Content[] = [];
  const jutsuInfoOf = new Map<string, WikiJutsu>();
  let acceptedExtras = 0;
  src.jutsus.forEach((jutsu, index) => {
    const info = infos.get(jutsu.wiki);
    if (info === undefined || info === null) {
      jutsuProblems.push(`${jutsu.id}: no existe la página "${jutsu.wiki}" en Narutopedia`);
      return;
    }
    jutsuInfoOf.set(jutsu.id, info);
    const users = info.users.filter((user) => !user.tagged).flatMap((user) => idByName.get(normalize(user.name)) ?? []);
    if (!users.includes(jutsu.answer)) {
      jutsuProblems.push(`${jutsu.id}: ${nameById(jutsu.answer)} no figura entre los usuarios de la infobox de "${info.title}"`);
    }
    const accepts = [...new Set(users)].filter((id) => id !== jutsu.answer).sort();
    acceptedExtras += accepts.length;
    const series = jutsu.series ?? info.debutSeries;
    if (series === null) {
      jutsuProblems.push(`${jutsu.id}: la infobox no dice en qué serie debuta; indicar "series" en jutsus.json`);
      return;
    }
    if (!(characterById.get(jutsu.answer) as CharacterSrc).series.includes(series)) {
      jutsuProblems.push(`${jutsu.id}: es de ${series}, que ${jutsu.answer} no tiene`);
      return;
    }
    const image = jutsuImages[index];
    if (image === null) return;
    jutsuContents.push({
      id: `jutsu-${jutsu.id}`,
      kind: 'jutsu',
      entityId: jutsu.answer,
      series,
      payload: { name: jutsu.name, image: `naruto/jutsus/${jutsu.id}`, width: image.width, height: image.height, accepts },
      verified: jutsu.verified,
    });
  });
  if (jutsuProblems.length > 0) fail('Los jutsus de data-src/naruto/jutsus.json no coinciden con Narutopedia', jutsuProblems);

  // Primero lo que no depende de las imágenes, después los jutsus: cargar imágenes no reordena el resto.
  const contents = [...quotes, ...teams, ...emojis, ...groups, ...eyes, ...jutsuContents];

  const arcsOutput = {
    series: SERIES.map((id, index) => ({ id, order: index + 1 })),
    arcs: [...src.arcs]
      .map((arc) => ({ id: arc.id, name: arc.name, series: arc.series, order: arcRank.get(arc.id) as number }))
      .sort((a, b) => a.order - b.order),
  };
  const arcsCheck = arcsOutputSchema.safeParse(arcsOutput);
  if (!arcsCheck.success) fail('arcs.json generado no cumple el esquema', [arcsCheck.error.message]);

  step('Validando…');
  await validate(characters, contents, src.groups);

  step('Escribiendo data/naruto/…');
  await writeJson(path.join(DATA_DIR, 'entities.json'), characters);
  await writeJson(path.join(DATA_DIR, 'content.json'), contents);
  await writeJson(path.join(DATA_DIR, 'arcs.json'), arcsOutput);

  // Lo que falta cargar a mano
  const missingCharacters: MissingImage[] = src.characters
    .filter((_, index) => characterImages[index].image === null)
    .map((character) => {
      const api = apis[src.characters.indexOf(character)];
      const first = api.images?.[0];
      return {
        id: character.id,
        name: character.name,
        file: `data-src/naruto/images/characters/${character.id}`,
        wikiPage: wikiTitleOf(character),
        wikiFile: first === undefined ? undefined : decodeURIComponent(path.basename(new URL(first).pathname)),
      };
    });
  const missingJutsus: MissingImage[] = src.jutsus
    .filter((_, index) => jutsuImages[index] === null)
    .map((jutsu) => {
      const info = jutsuInfoOf.get(jutsu.id) as WikiJutsu;
      return {
        id: jutsu.id,
        name: jutsu.name,
        file: `data-src/naruto/images/jutsus/${jutsu.id}`,
        wikiPage: info.title,
        wikiFile: info.image ?? undefined,
        note: nameById(jutsu.answer),
      };
    });
  const jutsuAnswers = new Set(jutsuContents.map((content) => content.entityId)).size;
  const opaque = characters.filter((entity) => entity.attrs.imagenTransparente === 0).map((entity) => ({ id: entity.id, name: entity.name.es }));
  const verifiedQuotes = quotes.filter((content) => content.verified);
  await writeTodoSection(
    TODO_FILE,
    renderTodoSection({
      characters: missingCharacters,
      jutsus: missingJutsus,
      opaque,
      charactersWithImage: characters.length - missingCharacters.length,
      jutsuPoolMinimum: POOL_MINIMUM,
      jutsuAnswersWithImage: jutsuAnswers,
      quotesUnverified: quotes.length - verifiedQuotes.length,
      quotesTotal: quotes.length,
      quotePoolMinimum: POOL_MINIMUM,
      quoteAnswersVerified: new Set(verifiedQuotes.map((content) => content.entityId)).size,
    }),
  );

  const bySeries = Object.fromEntries(
    SERIES.map((series) => [
      series,
      countBoards(
        src.groups.filter((group) => group.series === series),
        (id) => (characterById.get(id) as CharacterSrc).series.includes(series),
      ),
    ]),
  ) as Record<SeriesId, number>;
  const imageBytesProject = await directoryBytes(IMG_ROOT);
  printReport({
    characters,
    contents,
    arcCount: src.arcs.length,
    rendered: {
      characters: characterImages.flatMap((result) => result.rendered),
      jutsus: jutsuImages.flatMap((result) => result?.rendered ?? []),
    },
    unverified: [
      { label: 'personajes', unverified: src.characters.filter((item) => !item.verified).length, total: src.characters.length },
      { label: 'frases', unverified: src.quotes.filter((item) => !item.verified).length, total: src.quotes.length },
      { label: 'jutsus', unverified: src.jutsus.filter((item) => !item.verified).length, total: src.jutsus.length },
      { label: 'equipos', unverified: src.teams.filter((item) => !item.verified).length, total: src.teams.length },
      { label: 'emojis', unverified: src.emojis.filter((item) => !item.verified).length, total: src.emojis.length },
      { label: 'grupos', unverified: src.groups.filter((item) => !item.verified).length, total: src.groups.length },
    ],
    missing: { characters: missingCharacters.length, jutsus: missingJutsus.length },
    opaqueImages: opaque.map((item) => item.id),
    jutsusTotal: src.jutsus.length,
    jutsuAnswers,
    boards: { all: countBoards(src.groups), bySeries },
    groupCount: src.groups.length,
    sharedMembers: new Set(src.groups.flatMap((group) => [...(shared.get(group.id) ?? new Map()).keys()])).size,
    jutsuTypeStats: { jutsuTotal: titles.length, resolved: resolvedJutsu },
    acceptedExtras,
    teamHints,
    imageBytesNaruto: await directoryBytes(IMAGE_DIR),
    imageBytesProject,
  });
  if (imageBytesProject > IMG_LIMIT_BYTES) {
    console.warn('AVISO: public/img supera los 150 MB de la SPEC (sección 7). Avisar antes de seguir.');
  }
  step('Listo.');
}

main().catch((error: unknown) => {
  console.error(`\nERROR: ${error instanceof Error ? error.message : String(error)}`);
  if (process.env.DEBUG !== undefined && error instanceof Error) console.error(error.stack);
  process.exitCode = 1;
});
