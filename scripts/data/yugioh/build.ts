// npm run data:yugioh
//
// Genera el dataset de Yu-Gi-Oh combinando lo curado a mano (data-src/yugioh/) con las fuentes de la SPEC
// (sección 7). Decisión de la sesión 12: por ahora solo Duel Monsters, GX y 5D's.
//   data/yugioh/entities.json   los duelistas (la entidad principal del modo Duelista)
//   data/yugioh/cards.json      las cartas insignia (la entidad de Carta, Silueta, Arte, Zoom, Texto y Mayor o Menor)
//   data/yugioh/content.json    texto de cada carta, deck de cada duelista, invocaciones y carta as entera
//   data/yugioh/series.json     el orden de las series (de ahí sale "serie de debut")
//   public/img/yugioh/          imágenes en WebP, 256 y 512 px
//
// Qué sale de cada fuente:
//   - Yu-Gi-Oh! Wiki de Fandom: la categoría de personajes de cada serie. Cada duelista curado tiene que estar
//     en la de sus series: la serie no sale de memoria.
//   - Yugipedia: género y episodio de debut (infobox), las listas de deck con las que se comprueba que cada carta
//     curada es del duelista, y la imagen del duelista.
//   - YGOPRODeck: stats, id, konami_id y las imágenes de las cartas (cada una se baja una sola vez).
//   - YGOResources: el nombre y el texto oficiales en español de cada carta (clave "es"). No se traducen.
//   - data-src/: la lista de duelistas y de cartas insignia (con su iconicidad y la carta as), el rol, las afiliaciones,
//     los arquetipos y las invocaciones. Lo redactado va con `verified: false`.
//
// Las respuestas de las APIs quedan en .cache/ (ignorada por git); la salida es determinista.
// Si algo no cumple (esquema, referencias, fuentes, imágenes), falla sin escribir los JSON.

import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { Content, Entity } from '../../../src/engine/types.ts';
import { ROOT, mapPool } from './api.ts';
import {
  SIZES,
  imageDimensions,
  imageFileName,
  readManualImage,
  renderCardArt,
  renderCardFace,
  renderEntityImage,
  type Rendered,
} from './images.ts';
import { printReport } from './report.ts';
import { cleanCutout, isUsable, loadSegmenter, measureCutout, renderSilhouette, type Segmenter } from './silhouette.ts';
import {
  SERIES,
  contentSchema,
  cardEntitySchema,
  duelistEntitySchema,
  duelistSrcSchema,
  seriesOutputSchema,
  signatureCardsSrcSchema,
  silhouetteRecordsSchema,
  summonSrcSchema,
  translationsSchema,
  type DuelistSrc,
  type SilhouetteRecord,
  type SeriesId,
  type SignatureCardsSrc,
  type SummonSrc,
  type Translations,
  type YgoprodeckCard,
} from './schemas.ts';
import {
  fetchCardImage,
  fetchCards,
  fetchCategoryTitles,
  fetchFileImage,
  fetchImageFile,
  fetchPageImage,
  fetchPageTexts,
  fetchSpanish,
  type SpanishCard,
} from './sources.ts';
import { renderReview, writeReview, type ReviewDuelist } from './review.ts';
import { renderTodoSection, writeTodoSection, type MissingDuelistImage } from './todo.ts';
import {
  buildAceCardContents,
  buildCardEntity,
  buildCardTextContents,
  buildDeckContents,
  buildDuelistEntity,
  buildSilhouetteContents,
  buildSummonContents,
  evidenceOf,
  isMonster,
  leaksName,
  maskName,
  orderSeries,
  pageLinks,
  parseDebut,
  parseInfobox,
  quotedMaterials,
  slugify,
  summoningOf,
  type DeckCard,
  type Evidence,
  type Owner,
  type SummonInput,
} from './transform.ts';

const SRC_DIR = path.join(ROOT, 'data-src', 'yugioh');
const MANUAL_DIR = path.join(SRC_DIR, 'images', 'duelists');
const DATA_DIR = path.join(ROOT, 'data', 'yugioh');
const IMG_ROOT = path.join(ROOT, 'public', 'img');
const IMAGE_DIR = path.join(IMG_ROOT, 'yugioh');
const DUELIST_IMAGE_DIR = path.join(IMAGE_DIR, 'duelists');
const CARD_IMAGE_DIR = path.join(IMAGE_DIR, 'cards');
const FACE_IMAGE_DIR = path.join(IMAGE_DIR, 'cards-full');
const SILHOUETTE_DIR = path.join(IMAGE_DIR, 'silhouettes');
const SILHOUETTE_CACHE = path.join(ROOT, '.cache', 'yugioh', 'silhouettes');
const SILHOUETTES_FILE = path.join(DATA_DIR, 'silhouettes.json');
const TODO_FILE = path.join(ROOT, 'docs', 'CONTENT_TODO.md');
const REVIEW_FILE = path.join(ROOT, 'docs', 'REVISION_YUGIOH.md');

const IMAGE_TASKS = 4;
const IMG_LIMIT_BYTES = 200 * 1024 * 1024;

/** Categoría de personajes de cada serie en la Yu-Gi-Oh! Wiki de Fandom. */
const FANDOM_CATEGORIES: Readonly<Record<SeriesId, string>> = {
  dm: 'Yu-Gi-Oh! characters',
  gx: 'Yu-Gi-Oh! GX characters',
  '5ds': "Yu-Gi-Oh! 5D's characters",
  zexal: 'Yu-Gi-Oh! ZEXAL characters',
  arcv: 'Yu-Gi-Oh! ARC-V characters',
  vrains: 'Yu-Gi-Oh! VRAINS characters',
};

/** Cómo debe llamarse el tipo de carta de YGOPRODeck para cada clase de invocación curada en summons.json. */
const SUMMON_TYPE: Readonly<Record<SummonSrc[number]['kind'], RegExp>> = {
  fusion: /Fusion/,
  synchro: /Synchro/,
  xyz: /XYZ/,
  ritual: /Ritual/,
};

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

async function readSrc<T>(file: string, schema: z.ZodType<T>): Promise<T> {
  const parsed = schema.safeParse(JSON.parse(await readFile(path.join(SRC_DIR, file), 'utf8')) as unknown);
  if (!parsed.success) {
    fail(
      `data-src/yugioh/${file} no cumple el esquema`,
      parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  }
  return parsed.data;
}

interface Src {
  readonly duelists: DuelistSrc[];
  readonly signature: SignatureCardsSrc;
  readonly summons: SummonSrc;
  readonly translations: Translations;
}

async function loadSrc(): Promise<Src> {
  return {
    duelists: await readSrc('duelists.json', z.array(duelistSrcSchema).min(1)),
    signature: await readSrc('signature-cards.json', signatureCardsSrcSchema),
    summons: await readSrc('summons.json', summonSrcSchema),
    translations: await readSrc('translations.json', translationsSchema),
  };
}

/** Referencias cruzadas y reglas de lo curado (lo que no necesita las fuentes). */
function checkSrc(src: Src): void {
  const problems: string[] = [];
  const ids = src.duelists.map((duelist) => duelist.id);
  for (const id of duplicates(ids)) problems.push(`duelista repetido: ${id}`);
  const known = new Set(ids);

  const listed = src.signature.map((entry) => entry.duelist);
  for (const id of duplicates(listed)) problems.push(`signature-cards.json: hay dos entradas de ${id}`);
  for (const id of listed) if (!known.has(id)) problems.push(`signature-cards.json: ${id} no está en duelists.json`);
  for (const id of ids) if (!listed.includes(id)) problems.push(`signature-cards.json: falta la lista de cartas de ${id}`);

  const aceOwner = new Map<string, string>();
  for (const entry of src.signature) {
    const names = entry.cards.map((card) => card.name);
    for (const name of duplicates(names)) problems.push(`${entry.duelist}: la carta "${name}" está dos veces`);
    const aces = entry.cards.filter((card) => card.ace === true);
    if (aces.length !== 1) problems.push(`${entry.duelist}: tiene que haber exactamente una carta as y hay ${aces.length}`);
    for (const ace of aces) {
      const other = aceOwner.get(ace.name);
      if (other !== undefined) problems.push(`la carta as "${ace.name}" es de ${other} y de ${entry.duelist}: Carta insignia no tendría una única respuesta`);
      aceOwner.set(ace.name, entry.duelist);
    }
  }

  const pool = new Set(src.signature.flatMap((entry) => entry.cards.map((card) => card.name)));
  for (const summon of src.summons) {
    if (!pool.has(summon.card)) problems.push(`summons.json: "${summon.card}" no es una carta insignia`);
    for (const material of summon.materials) if (!pool.has(material)) problems.push(`summons.json: el material "${material}" de "${summon.card}" no es una carta insignia`);
  }
  for (const name of duplicates(src.summons.map((summon) => summon.card))) problems.push(`summons.json: "${name}" está dos veces`);

  for (const duelist of src.duelists) {
    if (!duelist.series.every((id, index) => index === 0 || SERIES.indexOf(duelist.series[index - 1]) < SERIES.indexOf(id))) {
      problems.push(`${duelist.id}: las series tienen que ir en orden canónico`);
    }
  }
  if (problems.length > 0) fail('Lo curado en data-src/yugioh/ no es consistente', problems);
}

// --- 2. Fuentes ---------------------------------------------------------------

/** Cada duelista tiene que estar en la categoría de Fandom de cada una de sus series. */
async function checkCategories(src: Src): Promise<void> {
  const used = orderSeries(src.duelists.flatMap((duelist) => duelist.series));
  const members = new Map<SeriesId, Set<string>>();
  for (const series of used) members.set(series, new Set(await fetchCategoryTitles(FANDOM_CATEGORIES[series])));
  const problems: string[] = [];
  for (const duelist of src.duelists) {
    for (const series of duelist.series) {
      if (!members.get(series)?.has(duelist.fandom)) problems.push(`${duelist.id}: "${duelist.fandom}" no está en la categoría "${FANDOM_CATEGORIES[series]}" de Fandom`);
    }
  }
  if (problems.length > 0) fail('Series que Fandom no respalda', problems);
}

interface DuelistFacts {
  readonly gender: string;
  readonly debut: NonNullable<ReturnType<typeof parseDebut>>;
  readonly links: ReturnType<typeof pageLinks>;
  readonly yugipedia: string;
}

/** Género, debut y los enlaces de las páginas de cada duelista en Yugipedia. */
async function loadDuelistFacts(src: Src): Promise<Map<string, DuelistFacts>> {
  const pagesOf = (duelist: DuelistSrc) => {
    const main = duelist.yugipedia ?? duelist.fandom;
    return { main, all: [main, `${main}'s Decks`, ...(duelist.extraPages ?? [])] };
  };
  const texts = await fetchPageTexts(src.duelists.flatMap((duelist) => pagesOf(duelist).all));
  const problems: string[] = [];
  const facts = new Map<string, DuelistFacts>();
  for (const duelist of src.duelists) {
    const { main, all } = pagesOf(duelist);
    const mainText = texts.get(main);
    if (mainText === null || mainText === undefined) {
      problems.push(`${duelist.id}: la página "${main}" no existe en Yugipedia`);
      continue;
    }
    const infobox = parseInfobox(mainText);
    const debut = parseDebut(infobox.anime_debut);
    const gender = infobox.gender;
    if (debut === null) problems.push(`${duelist.id}: la infobox de "${main}" no trae el episodio de debut (anime_debut)`);
    else if (debut.series !== duelist.series[0]) problems.push(`${duelist.id}: Yugipedia dice que debutó en ${debut.series} y data-src dice ${duelist.series[0]}`);
    if (gender === undefined || src.translations.gender[gender] === undefined) problems.push(`${duelist.id}: género "${gender ?? '(sin dato)'}" sin traducción`);
    if (debut === null || gender === undefined) continue;
    const found = all.map((title) => texts.get(title)).filter((text): text is string => typeof text === 'string');
    facts.set(duelist.id, { gender, debut, links: pageLinks(found), yugipedia: main });
  }
  if (problems.length > 0) fail('Datos de duelistas que Yugipedia no respalda', problems);
  return facts;
}

interface CardFacts {
  readonly api: YgoprodeckCard;
  readonly spanish: SpanishCard | null;
}

/** Las cartas listadas, con sus stats (YGOPRODeck) y su nombre y texto en español (YGOResources). */
async function loadCards(names: readonly string[]): Promise<Map<string, CardFacts>> {
  const found = await fetchCards(names);
  const missing = names.filter((name) => !found.has(name));
  if (missing.length > 0) fail('Cartas listadas que no existen en YGOPRODeck con ese nombre exacto', missing);
  const noKonami = names.filter((name) => found.get(name)?.misc_info[0].konami_id === undefined);
  if (noKonami.length > 0) fail('Cartas sin konami_id en YGOPRODeck (hace falta para pedir su texto en español)', noKonami);

  const spanish = await mapPool(names, 2, async (name) => {
    const api = found.get(name) as YgoprodeckCard;
    return fetchSpanish(api.misc_info[0].konami_id as number);
  });
  return new Map(names.map((name, index) => [name, { api: found.get(name) as YgoprodeckCard, spanish: spanish[index] }]));
}

// --- 3. Imágenes ----------------------------------------------------------------

async function directoryBytes(directory: string): Promise<number> {
  let total = 0;
  for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
    const entryPath = path.join(directory, entry.name);
    total += entry.isDirectory() ? await directoryBytes(entryPath) : (await stat(entryPath)).size;
  }
  return total;
}

interface DuelistImage {
  readonly rendered: Rendered[];
  readonly source: 'manual' | 'yugipedia';
  readonly transparent: boolean;
}

/** La imagen de un duelista: la cargada a mano si existe y, si no, la de su página de Yugipedia. */
async function duelistImage(src: DuelistSrc, facts: DuelistFacts): Promise<DuelistImage | null> {
  const manual = await readManualImage(MANUAL_DIR, src.id);
  if (manual !== null) {
    const result = await renderEntityImage(src.id, manual.buffer, DUELIST_IMAGE_DIR);
    return { rendered: result.rendered, source: 'manual', transparent: result.transparent };
  }
  const image = src.imageFile !== undefined ? await fetchFileImage(src.imageFile) : await fetchPageImage(facts.yugipedia);
  if (image === null) {
    if (src.imageFile !== undefined) throw new Error(`${src.id}: el archivo "${src.imageFile}" no existe en Yugipedia`);
    return null;
  }
  // Se nombra por el archivo de origen: si se elige otra imagen para el duelista, no se reutiliza la anterior de la caché.
  const buffer = await fetchImageFile(image.url, `duelists/${src.id}__${path.basename(new URL(image.url).pathname)}`);
  const result = await renderEntityImage(src.id, buffer, DUELIST_IMAGE_DIR);
  return { rendered: result.rendered, source: 'yugipedia', transparent: result.transparent };
}

// --- Siluetas -------------------------------------------------------------------

const round3 = (value: number) => Math.round(value * 1000) / 1000;
const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const exists = (file: string) => stat(file).then(() => true, () => false);

async function readSilhouetteRecords(): Promise<Map<string, SilhouetteRecord>> {
  try {
    const parsed = silhouetteRecordsSchema.parse(JSON.parse(await readFile(SILHOUETTES_FILE, 'utf8')));
    return new Map(parsed.monsters.map((record) => [record.id, record]));
  } catch {
    return new Map();
  }
}

/**
 * La silueta de cada monstruo: su ilustración sin el fondo, en WebP con transparencia. Un monstruo con decisión previa
 * en data/yugioh/silhouettes.json (y sus archivos, si sirvió) no se vuelve a procesar. Si hay alguno por procesar, el
 * recorte sale de la caché o del modelo (que se carga y se baja recién ahí). Los archivos de monstruos cuyo recorte ya
 * no sirve se borran: public/img/yugioh/silhouettes/ tiene solo lo que usa el sitio.
 */
async function silhouettes(monsters: ReadonlyArray<{ id: string; api: YgoprodeckCard }>): Promise<{ records: SilhouetteRecord[]; rendered: Rendered[] }> {
  const previous = await readSilhouetteRecords();
  const hasFiles = async (id: string) => (await Promise.all(SIZES.map((size) => exists(path.join(SILHOUETTE_DIR, imageFileName(id, size)))))).every(Boolean);
  const records = new Map<string, SilhouetteRecord>();
  const pending: Array<(typeof monsters)[number]> = [];
  for (const monster of monsters) {
    const record = previous.get(monster.id);
    // Una decisión sirve si sigue siendo la que dan los umbrales de hoy (si se ajustaron, se vuelve a decidir con el recorte en caché).
    if (record !== undefined && record.usable === isUsable(record) && (!record.usable || (await hasFiles(monster.id)))) records.set(monster.id, record);
    else pending.push(monster);
  }

  const rendered: Rendered[] = [];
  if (pending.length > 0) {
    step(`Siluetas: ${pending.length} monstruos por recortar (cerca de 4 s cada uno; el modelo BiRefNet_lite, de 224 MB, se baja una sola vez)…`);
    let segment: Segmenter | null = null;
    for (const [index, monster] of pending.entries()) {
      const cacheFile = path.join(SILHOUETTE_CACHE, `${monster.id}.png`);
      let png: Buffer | null = await readFile(cacheFile).catch(() => null);
      if (png === null) {
        segment ??= await loadSegmenter();
        png = await segment(await fetchCardImage(monster.api, 'art'));
        await mkdir(SILHOUETTE_CACHE, { recursive: true });
        await writeFile(cacheFile, png);
      }
      // La caché guarda lo que dio el modelo; la limpieza se aplica siempre, así ajustarla no obliga a volver a correrlo.
      png = await cleanCutout(png);
      const measured = await measureCutout(png);
      // Se decide con las medidas redondeadas, que son las que quedan guardadas: así la decisión siempre se puede volver a comprobar.
      const metrics = { coverage: round3(measured.coverage), connected: round3(measured.connected) };
      const usable = isUsable(metrics);
      if (usable) rendered.push(...(await renderSilhouette(monster.id, png, SILHOUETTE_DIR)));
      records.set(monster.id, { id: monster.id, ...metrics, usable });
      if ((index + 1) % 25 === 0) step(`  ${index + 1} de ${pending.length}`);
    }
  }

  const keep = new Set([...records.values()].filter((record) => record.usable).map((record) => record.id));
  for (const file of await readdir(SILHOUETTE_DIR).catch(() => [])) {
    const id = file.replace(/-(256|512)\.webp$/, '');
    if (!keep.has(id)) await rm(path.join(SILHOUETTE_DIR, file));
  }
  return { records: [...records.values()].sort(byId), rendered };
}

// --- 4. Escritura ----------------------------------------------------------------

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

function validate<T>(label: string, schema: z.ZodType<T>, items: readonly unknown[], idOf: (item: unknown) => string): void {
  const problems: string[] = [];
  for (const item of items) {
    const parsed = schema.safeParse(item);
    if (!parsed.success) problems.push(`${idOf(item)}: ${parsed.error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`).join('; ')}`);
  }
  if (problems.length > 0) fail(`${label} no cumplen el esquema`, problems);
}

// --- Programa ---------------------------------------------------------------------

async function main(): Promise<void> {
  step('Leyendo data-src/yugioh/…');
  const src = await loadSrc();
  checkSrc(src);
  const { translations } = src;
  const duelistById = new Map(src.duelists.map((duelist) => [duelist.id, duelist]));
  const signatureOf = new Map(src.signature.map((entry) => [entry.duelist, entry]));
  const cardNames = [...new Set(src.signature.flatMap((entry) => entry.cards.map((card) => card.name)))].sort();
  step(`${src.duelists.length} duelistas, ${cardNames.length} cartas insignia distintas, ${src.summons.length} invocaciones.`);

  step('Comprobando las series en las categorías de Fandom…');
  await checkCategories(src);
  step('Leyendo las páginas de los duelistas en Yugipedia…');
  const facts = await loadDuelistFacts(src);
  step('Leyendo las cartas en YGOPRODeck y YGOResources (queda en caché)…');
  const cards = await loadCards(cardNames);

  // Ids de las cartas: el nombre oficial en inglés, en kebab-case. Si dos nombres dan el mismo id, falla.
  const cardId = new Map(cardNames.map((name) => [name, slugify(name)]));
  const repeatedIds = duplicates([...cardId.values()]);
  if (repeatedIds.length > 0) fail('Dos cartas darían el mismo id', repeatedIds);

  // Respaldo: cada carta insignia tiene que aparecer en las páginas de Yugipedia de su duelista.
  const evidence = new Map<string, Evidence>();
  const noEvidence: string[] = [];
  const weakEvidence: Array<{ duelist: string; card: string }> = [];
  for (const entry of src.signature) {
    const links = (facts.get(entry.duelist) as DuelistFacts).links;
    for (const card of entry.cards) {
      const found = evidenceOf(card.name, links);
      evidence.set(`${entry.duelist}|${card.name}`, found);
      if (found === 'none') noEvidence.push(`${entry.duelist}: ${card.name}`);
      else if (found === 'page') weakEvidence.push({ duelist: (duelistById.get(entry.duelist) as DuelistSrc).name, card: card.name });
    }
  }
  if (noEvidence.length > 0) fail('Cartas que las páginas de Yugipedia de su duelista no respaldan (ante la duda, queda afuera)', noEvidence);

  // Invocaciones: los materiales curados tienen que ser los que dice el texto de la carta.
  const summonProblems: string[] = [];
  for (const summon of src.summons) {
    const api = (cards.get(summon.card) as CardFacts).api;
    if (!SUMMON_TYPE[summon.kind].test(api.type)) summonProblems.push(`"${summon.card}" es "${api.type}" y summons.json dice ${summon.kind}`);
    const quoted = quotedMaterials(api.desc).map((name) => name.toLowerCase());
    const wanted = summon.materials.map((name) => name.toLowerCase());
    if (quoted.length !== wanted.length || quoted.some((name, index) => name !== wanted[index])) {
      summonProblems.push(`"${summon.card}": el texto dice [${quotedMaterials(api.desc).join(' + ')}] y summons.json dice [${summon.materials.join(' + ')}]`);
    }
  }
  if (summonProblems.length > 0) fail('Invocaciones que no coinciden con el texto de la carta', summonProblems);

  // --- Entidades y contenidos ---
  step('Armando entidades y contenidos…');
  const ownersOf = new Map<string, Owner[]>();
  for (const entry of src.signature) {
    const duelist = duelistById.get(entry.duelist) as DuelistSrc;
    for (const card of entry.cards) {
      const list = ownersOf.get(card.name) ?? [];
      list.push({ id: duelist.id, name: duelist.name, series: duelist.series });
      ownersOf.set(card.name, list);
    }
  }
  const imageStem = (name: string) => `yugioh/cards/${cardId.get(name)}`;
  const cardEntities: Entity[] = cardNames.map((name) => {
    const facts = cards.get(name) as CardFacts;
    return buildCardEntity(
      { id: cardId.get(name) as string, api: facts.api, spanishName: facts.spanish?.name ?? null, owners: ownersOf.get(name) as Owner[], image: imageStem(name) },
      translations,
    );
  });

  const contents: Content[] = [];
  const withoutSpanish: Array<{ name: string; owners: string }> = [];
  for (const entity of cardEntities) {
    const name = entity.name.en as string;
    const facts = cards.get(name) as CardFacts;
    const names = [entity.name.es, name];
    if (facts.spanish === null) {
      withoutSpanish.push({ name, owners: (ownersOf.get(name) as Owner[]).map((owner) => owner.name).join(', ') });
      continue;
    }
    if (facts.spanish.text === null) {
      withoutSpanish.push({ name, owners: `${(ownersOf.get(name) as Owner[]).map((owner) => owner.name).join(', ')}; sin texto en español` });
      continue;
    }
    const text = maskName(facts.spanish.text, names);
    if (leaksName(text, names)) fail('El texto de una carta dejó su nombre a la vista', [entity.id]);
    contents.push(...buildCardTextContents(entity.id, entity.series as SeriesId[], text));
  }

  const displayName = (name: string) => cardEntities.find((entity) => entity.name.en === name)?.name.es as string;
  const summonInputs: SummonInput[] = src.summons.map((summon) => ({
    cardId: cardId.get(summon.card) as string,
    kind: summon.kind,
    series: cardEntities.find((entity) => entity.name.en === summon.card)?.series as SeriesId[],
    items: summon.materials.map(displayName),
    materialIds: summon.materials.map((name) => cardId.get(name) as string),
  }));
  for (const input of summonInputs) contents.push(...buildSummonContents(input, summonInputs));

  // Imágenes de los duelistas (antes que las entidades: `image` e `imagenTransparente` salen de ellas).
  step('Imágenes de los duelistas…');
  const duelistImages = await mapPool(src.duelists, IMAGE_TASKS, (duelist) => duelistImage(duelist, facts.get(duelist.id) as DuelistFacts));

  const duelistEntities: Entity[] = src.duelists.map((duelist, index) => {
    const image = duelistImages[index];
    const summoning = (signatureOf.get(duelist.id)?.cards ?? []).flatMap((card) => {
      const kind = summoningOf((cards.get(card.name) as CardFacts).api, translations);
      return kind === null ? [] : [kind];
    });
    const f = facts.get(duelist.id) as DuelistFacts;
    return buildDuelistEntity(
      {
        src: duelist,
        gender: f.gender,
        debut: f.debut,
        summoning,
        image: image === null ? null : `yugioh/duelists/${duelist.id}`,
        transparent: image?.transparent ?? false,
      },
      translations,
    );
  });

  // Imágenes de las cartas: la ilustración de todas y la carta entera solo de las cartas as.
  step('Ilustraciones de las cartas (se bajan una sola vez)…');
  const art = await mapPool(cardNames, IMAGE_TASKS, async (name) => {
    const buffer = await fetchCardImage((cards.get(name) as CardFacts).api, 'art');
    return renderCardArt(cardId.get(name) as string, buffer, CARD_IMAGE_DIR);
  });
  step('Siluetas de los monstruos…');
  const silhouetteResult = await silhouettes(
    cardNames.flatMap((name) => {
      const api = (cards.get(name) as CardFacts).api;
      return isMonster(api) ? [{ id: cardId.get(name) as string, api }] : [];
    }),
  );
  for (const record of silhouetteResult.records) {
    if (!record.usable) continue;
    const entity = cardEntities.find((candidate) => candidate.id === record.id) as Entity;
    contents.push(...buildSilhouetteContents(entity.id, entity.series as SeriesId[], `yugioh/silhouettes/${entity.id}`));
  }
  const aceCards = src.signature.map((entry) => ({ duelist: entry.duelist, name: (entry.cards.find((card) => card.ace === true) as { name: string }).name }));
  step('Cartas as enteras…');
  const faces = await mapPool(aceCards, IMAGE_TASKS, async (ace) => {
    const buffer = await fetchCardImage((cards.get(ace.name) as CardFacts).api, 'full');
    const id = cardId.get(ace.name) as string;
    const rendered = await renderCardFace(id, buffer, FACE_IMAGE_DIR);
    const { width, height } = await imageDimensions(path.join(FACE_IMAGE_DIR, imageFileName(id, 512)));
    return { ace, id, rendered, width, height };
  });

  for (const entry of src.signature) {
    const duelist = duelistById.get(entry.duelist) as DuelistSrc;
    const deck: DeckCard[] = entry.cards.map((card) => ({
      id: cardId.get(card.name) as string,
      displayName: displayName(card.name),
      iconicity: card.iconicity,
      ace: card.ace === true,
    }));
    contents.push(...buildDeckContents(duelist.id, duelist.series, deck));
    const face = faces.find((item) => item.ace.duelist === duelist.id) as (typeof faces)[number];
    contents.push(...buildAceCardContents(duelist.id, duelist.series, { id: face.id, image: `yugioh/cards-full/${face.id}`, width: face.width, height: face.height }));
  }

  // --- Validación de la salida ---
  validate('Los duelistas', duelistEntitySchema, duelistEntities, (item) => (item as Entity).id);
  validate('Las cartas', cardEntitySchema, cardEntities, (item) => (item as Entity).id);
  contents.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  validate('Los contenidos', contentSchema, contents, (item) => (item as Content).id);
  const entityList = [...duelistEntities, ...cardEntities].map((entity) => entity.id);
  const entityIds = new Set(entityList);
  const idProblems = duplicates(entityList).map((id) => `id de entidad repetido: ${id}`);
  for (const id of duplicates(contents.map((content) => content.id))) idProblems.push(`id de contenido repetido: ${id}`);
  for (const content of contents) {
    if (content.entityId !== undefined && !entityIds.has(content.entityId)) idProblems.push(`${content.id}: su entidad ${content.entityId} no existe`);
    for (const other of (content.payload.accepts as string[] | undefined) ?? []) if (!entityIds.has(other)) idProblems.push(`${content.id}: acepta ${other}, que no existe`);
  }
  if (idProblems.length > 0) fail('Referencias inválidas en el dataset generado', idProblems);

  step('Escribiendo data/yugioh/…');
  await writeJson(path.join(DATA_DIR, 'entities.json'), duelistEntities);
  await writeJson(path.join(DATA_DIR, 'cards.json'), cardEntities);
  await writeJson(path.join(DATA_DIR, 'content.json'), contents);
  validate('Las siluetas', silhouetteRecordsSchema, [{ monsters: silhouetteResult.records }], () => 'silhouettes.json');
  await writeJson(SILHOUETTES_FILE, { monsters: silhouetteResult.records });
  const seriesOutput = { series: SERIES.map((id, index) => ({ id, order: index + 1, label: translations.series[id] })) };
  validate('El orden de series', seriesOutputSchema, [seriesOutput], () => 'series.json');
  await writeJson(path.join(DATA_DIR, 'series.json'), seriesOutput);

  // --- Pendientes e informe ---
  const missingImages: MissingDuelistImage[] = src.duelists.flatMap((duelist, index) =>
    duelistImages[index] === null ? [{ id: duelist.id, name: duelist.name, wikiPage: (facts.get(duelist.id) as DuelistFacts).yugipedia }] : [],
  );
  const imageBytesProject = await directoryBytes(IMG_ROOT);
  const imageBytesYugioh = await directoryBytes(IMAGE_DIR);
  const fromYugipedia = duelistImages.filter((image) => image?.source === 'yugipedia').length;
  const manual = duelistImages.filter((image) => image?.source === 'manual').length;
  await writeTodoSection(
    TODO_FILE,
    renderTodoSection({
      duelists: duelistEntities.length,
      cards: cardEntities.length,
      series: orderSeries(src.duelists.flatMap((duelist) => duelist.series)),
      missingImages,
      imagesFromYugipedia: fromYugipedia,
      imagesManual: manual,
      withoutSpanish,
      weakEvidence,
      unverified: {
        duelists: src.duelists.filter((duelist) => !duelist.verified).length,
        cards: src.signature.filter((entry) => !entry.verified).length,
        summons: src.summons.filter((summon) => !summon.verified).length,
      },
      silhouettes: {
        monsters: silhouetteResult.records.length,
        usable: silhouetteResult.records.filter((record) => record.usable).length,
        rejected: silhouetteResult.records.filter((record) => !record.usable).map((record) => record.id),
      },
      imageBytesProject,
    }),
  );

  // Documento de revisión: todos los duelistas y sus cartas, por serie.
  const review: ReviewDuelist[] = src.duelists.map((duelist, index) => {
    const entity = duelistEntities[index];
    return {
      src: duelist,
      gender: String(entity.attrs.genero),
      firstAppearance: String(entity.attrs.primeraAparicion),
      summoning: entity.attrs.metodosInvocacion as string[],
      image: duelistImages[index]?.source ?? 'ninguna',
      cards: (signatureOf.get(duelist.id) as SignatureCardsSrc[number]).cards.map((card) => ({
        english: card.name,
        spanish: displayName(card.name),
        iconicity: card.iconicity,
        ace: card.ace === true,
        evidence: evidence.get(`${duelist.id}|${card.name}`) as Evidence,
        sharedWith: (ownersOf.get(card.name) as Owner[]).filter((owner) => owner.id !== duelist.id).map((owner) => owner.name),
      })),
    };
  });
  await writeReview(REVIEW_FILE, renderReview(review, SERIES, translations));

  printReport({
    duelists: duelistEntities,
    cards: cardEntities,
    contents,
    cardsPerDuelist: new Map(src.signature.map((entry) => [entry.duelist, entry.cards.length])),
    summonCandidates: cardNames.filter((name) => {
      const api = (cards.get(name) as CardFacts).api;
      return isMonster(api) && /Fusion|Synchro|XYZ|Ritual|Link/.test(api.type);
    }).length,
    withoutSpanish: withoutSpanish.map((item) => item.name),
    weakEvidence: weakEvidence.length,
    rendered: {
      duelists: duelistImages.flatMap((image) => image?.rendered ?? []),
      art: art.flat(),
      faces: faces.flatMap((face) => face.rendered),
      silhouettes: silhouetteResult.rendered,
    },
    silhouettes: { monsters: silhouetteResult.records.length, usable: silhouetteResult.records.filter((record) => record.usable).length },
    images: { fromYugipedia, manual, missing: missingImages.length },
    unverified: {
      duelists: src.duelists.filter((duelist) => !duelist.verified).length,
      cards: src.signature.filter((entry) => !entry.verified).length,
      summons: src.summons.filter((summon) => !summon.verified).length,
    },
    imageBytesYugioh,
    imageBytesProject,
  });
  if (imageBytesProject > IMG_LIMIT_BYTES) {
    console.warn('AVISO: public/img supera los 200 MB de la SPEC (sección 7). Avisar antes de seguir.');
  }
  step('Listo.');
}

main().catch((error: unknown) => {
  console.error(`\nERROR: ${error instanceof Error ? error.message : String(error)}`);
  if (process.env.DEBUG !== undefined && error instanceof Error) console.error(error.stack);
  process.exitCode = 1;
});
