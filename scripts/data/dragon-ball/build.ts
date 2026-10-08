// npm run data:dragon-ball
//
// Genera el dataset de Dragon Ball combinando lo curado a mano (data-src/dragon-ball/)
// con lo que se puede sacar de las fuentes de la SPEC (sección 7):
//   data/dragon-ball/entities.json         los personajes, con sus atributos del Clásico
//   data/dragon-ball/transformations.json  las formas, como entidades propias (modo Transformación)
//   data/dragon-ball/content.json          frases (quote), técnicas (technique) y sucesos (event)
//   data/dragon-ball/sagas.json            series y sagas con su lugar en la cronología
//   public/img/dragon-ball/                imágenes en WebP, 256 y 512 px
//
// Qué sale de cada fuente:
//   - Dragon Ball API: la imagen (transparente) de los personajes y de las formas.
//   - Wiki en español (API MediaWiki): en qué series aparece cada personaje, según las categorías
//     "Personajes de Dragon Ball / Z / GT / Super / Daima". No sale de la memoria de nadie.
//   - data-src/: el resto (atributos, frases, sucesos, ki, técnicas), todo con `verified: false`
//     hasta que se revise a mano.
// Las imágenes de Fandom no se descargan (Cloudflare las protege): se cargan a mano en
// data-src/dragon-ball/images/ y quedan listadas en docs/CONTENT_TODO.md.
//
// Las respuestas de las APIs quedan en .cache/ (ignorada por git); la salida es determinista.
// Si algo no cumple (esquema, referencias, imágenes), falla sin escribir los JSON.

import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { Content, Entity } from '../../../src/engine/types.ts';
import {
  DRAGONBALL_API,
  DRAGONBALL_API_BASE,
  ROOT,
  WIKI_ES,
  WIKI_ES_API,
  getFile,
  getJson,
  mapPool,
} from './api.ts';
import {
  SIZES,
  imageDimensions,
  imageFileName,
  readManualImage,
  renderEntityImage,
  renderPlainImage,
  type Rendered,
} from './images.ts';
import { printReport } from './report.ts';
import {
  SERIES,
  apiCharacterListSchema,
  apiTransformationListSchema,
  characterEntitySchema,
  characterSrcSchema,
  contentSchema,
  eventSrcSchema,
  powerSrcSchema,
  quoteSrcSchema,
  sagasFileSchema,
  sagasOutputSchema,
  techniqueSrcSchema,
  transformationEntitySchema,
  transformationSrcSchema,
  wikiCategoryMembersSchema,
  type ApiCharacter,
  type ApiTransformation,
  type CharacterSrc,
  type EventSrc,
  type PowerSrc,
  type QuoteSrc,
  type SagasFile,
  type SeriesId,
  type TechniqueSrc,
  type TransformationSrc,
} from './schemas.ts';
import { renderTodoSection, writeTodoSection, type MissingImage } from './todo.ts';
import {
  buildCharacterEntity,
  buildEventContent,
  buildTransformationEntity,
  canonicalSeries,
  debutSeries,
  eventOrders,
  leaksName,
  sagaRanks,
  seriesOfPage,
  seriesRanks,
  type EntityImage,
} from './transform.ts';

const SRC_DIR = path.join(ROOT, 'data-src', 'dragon-ball');
const MANUAL_DIR = path.join(SRC_DIR, 'images');
const DATA_DIR = path.join(ROOT, 'data', 'dragon-ball');
const IMG_ROOT = path.join(ROOT, 'public', 'img');
const IMAGE_DIR = path.join(IMG_ROOT, 'dragon-ball');
const FORM_IMAGE_DIR = path.join(IMAGE_DIR, 'transformations');
const TECHNIQUE_IMAGE_DIR = path.join(IMAGE_DIR, 'techniques');
const TODO_FILE = path.join(ROOT, 'docs', 'CONTENT_TODO.md');

const IMAGE_TASKS = 4;
const IMG_LIMIT_BYTES = 150 * 1024 * 1024;
/** Pool mínimo del modo Técnica (SPEC 4, regla 6). */
const TECHNIQUE_POOL_MINIMUM = 10;

const CATEGORIES: Readonly<Record<SeriesId, string>> = {
  db: 'Personajes de Dragon Ball',
  dbz: 'Personajes de Dragon Ball Z',
  gt: 'Personajes de Dragon Ball GT',
  super: 'Personajes de Dragon Ball Super',
  daima: 'Personajes de Dragon Ball Daima',
};

const started = Date.now();
const step = (message: string) => console.log(`[${((Date.now() - started) / 1000).toFixed(0).padStart(3)} s] ${message}`);

function fail(title: string, problems: string[]): never {
  const shown = problems.slice(0, 30).map((problem) => `  - ${problem}`);
  if (problems.length > shown.length) shown.push(`  … y ${problems.length - shown.length} más`);
  throw new Error(`${title} (${problems.length}):\n${shown.join('\n')}`);
}

// --- 1. Lo curado a mano ----------------------------------------------------

async function readSrc<T>(file: string, schema: z.ZodType<T>): Promise<T[]> {
  const text = await readFile(path.join(SRC_DIR, file), 'utf8');
  const parsed = z.array(schema).safeParse(JSON.parse(text));
  if (!parsed.success) {
    fail(
      `data-src/dragon-ball/${file} no cumple el esquema`,
      parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  }
  return parsed.data;
}

interface Src {
  readonly sagas: SagasFile;
  readonly characters: CharacterSrc[];
  readonly transformations: TransformationSrc[];
  readonly techniques: TechniqueSrc[];
  readonly quotes: QuoteSrc[];
  readonly events: EventSrc[];
  readonly power: PowerSrc[];
}

async function loadSrc(): Promise<Src> {
  const sagasText = await readFile(path.join(SRC_DIR, 'sagas.json'), 'utf8');
  const sagas = sagasFileSchema.safeParse(JSON.parse(sagasText));
  if (!sagas.success) {
    fail('data-src/dragon-ball/sagas.json no cumple el esquema', sagas.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`));
  }
  return {
    sagas: sagas.data,
    characters: await readSrc('characters.json', characterSrcSchema),
    transformations: await readSrc('transformations.json', transformationSrcSchema),
    techniques: await readSrc('techniques.json', techniqueSrcSchema),
    quotes: await readSrc('quotes.json', quoteSrcSchema),
    events: await readSrc('events.json', eventSrcSchema),
    power: await readSrc('power.json', powerSrcSchema),
  };
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

/** Referencias cruzadas entre los archivos curados. */
function checkSrc(src: Src): void {
  const problems: string[] = [];
  const characterIds = new Set(src.characters.map((character) => character.id));
  const sagaIds = new Set(src.sagas.sagas.map((saga) => saga.id));

  for (const [file, ids] of [
    ['characters.json', src.characters.map((item) => item.id)],
    ['transformations.json', src.transformations.map((item) => item.id)],
    ['techniques.json', src.techniques.map((item) => item.id)],
    ['quotes.json', src.quotes.map((item) => item.id)],
    ['events.json', src.events.map((item) => item.id)],
    ['power.json', src.power.map((item) => item.id)],
  ] as const) {
    for (const id of duplicates(ids)) problems.push(`${file}: el id ${id} está repetido`);
  }
  for (const wiki of duplicates(src.characters.map((character) => character.wiki))) {
    problems.push(`characters.json: dos personajes usan la misma página de la wiki (${wiki})`);
  }
  for (const api of duplicates(src.characters.flatMap((character) => (character.api === undefined ? [] : [String(character.api)])))) {
    problems.push(`characters.json: dos personajes usan el mismo id de Dragon Ball API (${api})`);
  }
  for (const api of duplicates(src.transformations.map((form) => String(form.api)))) {
    problems.push(`transformations.json: dos formas usan el mismo id de Dragon Ball API (${api})`);
  }

  const characterById = new Map(src.characters.map((character) => [character.id, character]));
  for (const character of src.characters) {
    if (!sagaIds.has(character.sagaDebut)) problems.push(`${character.id}: la saga de debut ${character.sagaDebut} no existe en sagas.json`);
  }
  for (const form of src.transformations) {
    const owner = characterById.get(form.character);
    if (owner === undefined) {
      problems.push(`transformations.json: ${form.id} apunta al personaje inexistente ${form.character}`);
    } else if (!owner.transformaciones.some((item) => item.value === form.forma && item.series === form.series)) {
      problems.push(`${form.id}: ${owner.id} no tiene la transformación "${form.forma}" de ${form.series} en sus atributos`);
    }
  }
  for (const technique of src.techniques) {
    for (const user of technique.users) {
      if (!characterIds.has(user)) problems.push(`techniques.json: ${technique.id} nombra al personaje inexistente ${user}`);
    }
    if (new Set(technique.users).size !== technique.users.length) problems.push(`techniques.json: ${technique.id} repite usuarios`);
  }
  for (const quote of src.quotes) {
    const character = characterById.get(quote.character);
    if (character === undefined) {
      problems.push(`quotes.json: ${quote.id} apunta al personaje inexistente ${quote.character}`);
    } else if (leaksName(quote.text, [character.name, ...character.aliases])) {
      problems.push(`quotes.json: ${quote.id} dice el nombre de ${character.name}`);
    }
  }
  for (const entry of src.power) {
    if (!characterIds.has(entry.id)) problems.push(`power.json: ${entry.id} no es un personaje`);
    if (entry.official && entry.ki === null) problems.push(`power.json: ${entry.id} es oficial pero no tiene valor`);
  }
  if (problems.length > 0) fail('Los archivos de data-src/dragon-ball/ no son coherentes', problems);
}

// --- 2. Fuentes -------------------------------------------------------------

async function fetchApiCharacters(): Promise<ApiCharacter[]> {
  const items: ApiCharacter[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const result = await getJson(`${DRAGONBALL_API_BASE}/characters?limit=100&page=${page}`, apiCharacterListSchema, DRAGONBALL_API);
    items.push(...result.items);
    totalPages = result.meta.totalPages;
    page++;
  } while (page <= totalPages);
  return items;
}

async function fetchApiTransformations(): Promise<ApiTransformation[]> {
  return getJson(`${DRAGONBALL_API_BASE}/transformations?limit=100`, apiTransformationListSchema, DRAGONBALL_API);
}

/** Las páginas de cada categoría de personajes por serie de la wiki. */
async function fetchSeriesMembers(): Promise<Record<SeriesId, Set<string>>> {
  const members = {} as Record<SeriesId, Set<string>>;
  for (const series of SERIES) {
    const titles = new Set<string>();
    let more = '';
    do {
      const url =
        `${WIKI_ES_API}?action=query&list=categorymembers&cmtitle=${encodeURIComponent(`Categoría:${CATEGORIES[series]}`)}` +
        `&cmtype=page&cmlimit=500&format=json&formatversion=2${more}`;
      const result = await getJson(url, wikiCategoryMembersSchema, WIKI_ES);
      for (const member of result.query.categorymembers) titles.add(member.title);
      more = result.continue ? `&cmcontinue=${encodeURIComponent(result.continue.cmcontinue)}` : '';
    } while (more !== '');
    members[series] = titles;
  }
  return members;
}

// --- 3. Imágenes ------------------------------------------------------------

interface EntityImageResult {
  readonly image: EntityImage | null;
  readonly rendered: Rendered[];
  /** `manual` si salió de data-src/dragon-ball/images/, `api` si de Dragon Ball API. */
  readonly origin: 'manual' | 'api' | 'none';
}

const NO_IMAGE: EntityImageResult = { image: null, rendered: [], origin: 'none' };

/** Una imagen cargada a mano manda sobre la de la API: así se puede corregir una que no sirva. */
async function entityImage(
  id: string,
  stem: string,
  manualDirectory: string,
  outputDirectory: string,
  api: { url: string; cacheName: string } | null,
): Promise<EntityImageResult> {
  const manual = await readManualImage(manualDirectory, id);
  let buffer: Buffer;
  let origin: 'manual' | 'api';
  if (manual !== null) {
    buffer = manual.buffer;
    origin = 'manual';
  } else if (api !== null) {
    buffer = await getFile(api.url, api.cacheName, DRAGONBALL_API);
    origin = 'api';
  } else {
    return NO_IMAGE;
  }
  try {
    const { rendered, transparent } = await renderEntityImage(id, buffer, outputDirectory);
    return { image: { path: stem, transparent }, rendered, origin };
  } catch (error) {
    throw new Error(`Imagen de ${id} (${origin}): ${error instanceof Error ? error.message : String(error)}`);
  }
}

const apiFileName = (url: string) => path.basename(new URL(url).pathname);

// --- 4. Validación de la salida ---------------------------------------------

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

async function validate(
  src: Src,
  characters: Entity[],
  forms: Entity[],
  contents: Content[],
  debutOf: Map<string, SeriesId>,
  sagaSeries: Map<string, SeriesId>,
): Promise<void> {
  const problems: string[] = [];

  characters.forEach((entity) => {
    const result = characterEntitySchema.safeParse(entity);
    if (!result.success) problems.push(`personaje ${entity.id}: ${result.error.message}`);
  });
  forms.forEach((entity) => {
    const result = transformationEntitySchema.safeParse(entity);
    if (!result.success) problems.push(`forma ${entity.id}: ${result.error.message}`);
  });
  contents.forEach((content) => {
    const result = contentSchema.safeParse(content);
    if (!result.success) problems.push(`contenido ${content.id}: ${result.error.message}`);
  });

  for (const id of duplicates(characters.map((entity) => entity.id))) problems.push(`hay dos personajes con el id ${id}`);
  for (const id of duplicates(forms.map((entity) => entity.id))) problems.push(`hay dos formas con el id ${id}`);
  for (const id of duplicates(contents.map((content) => content.id))) problems.push(`hay dos contenidos con el id ${id}`);

  // Referencias: un contenido no puede apuntar a un personaje que no existe.
  const characterIds = new Set(characters.map((entity) => entity.id));
  for (const content of contents) {
    if (content.kind === 'event') continue;
    if (content.entityId === undefined || !characterIds.has(content.entityId)) {
      problems.push(`el contenido ${content.id} apunta a un personaje inexistente (${String(content.entityId)})`);
    }
    if (content.kind === 'technique') {
      for (const other of content.payload.accepts as string[]) {
        if (!characterIds.has(other)) problems.push(`${content.id}: acepta a ${other}, que no existe`);
        if (other === content.entityId) problems.push(`${content.id}: se acepta a sí mismo`);
      }
    }
  }

  // La saga de debut es de la serie de debut: de lo contrario la flecha del Clásico mentiría.
  for (const character of src.characters) {
    const debut = debutOf.get(character.id);
    const sagaOf = sagaSeries.get(character.sagaDebut);
    if (debut !== undefined && sagaOf !== undefined && debut !== sagaOf) {
      problems.push(`${character.id}: debuta en ${debut} según la wiki, pero su saga de debut (${character.sagaDebut}) es de ${sagaOf}`);
    }
  }

  // Cada serie tiene algo, y los números de debut están dentro de rango.
  for (const series of SERIES) {
    if (!characters.some((entity) => entity.series.includes(series))) problems.push(`no hay ningún personaje de ${series}`);
  }

  // Imágenes en disco: las dos variantes, WebP, lado mayor exacto y dentro del presupuesto.
  const imageChecks = await mapPool(
    [
      ...characters.map((entity) => ({ entity, directory: IMAGE_DIR, expected: `dragon-ball/${entity.id}` })),
      ...forms.map((entity) => ({ entity, directory: FORM_IMAGE_DIR, expected: `dragon-ball/transformations/${entity.id}` })),
    ],
    8,
    async ({ entity, directory, expected }) => {
      if (entity.image === undefined) return [];
      const found: string[] = [];
      if (entity.image !== expected) found.push(`${entity.id}: ruta de imagen inesperada (${entity.image})`);
      for (const size of SIZES) {
        found.push(...(await checkImageFile(path.join(directory, imageFileName(entity.id, size)), size, BUDGET[size], `${entity.id} (${size} px)`)));
      }
      return found;
    },
  );
  problems.push(...imageChecks.flat());

  const techniqueChecks = await mapPool(
    contents.filter((content) => content.kind === 'technique'),
    8,
    async (content) => {
      const found: string[] = [];
      const id = content.id.replace(/^technique-/, '');
      for (const size of SIZES) {
        found.push(...(await checkImageFile(path.join(TECHNIQUE_IMAGE_DIR, imageFileName(id, size)), size, BUDGET[size], `${content.id} (${size} px)`)));
      }
      const dimensions = await imageDimensions(path.join(TECHNIQUE_IMAGE_DIR, imageFileName(id, 512)));
      if (dimensions.width !== content.payload.width || dimensions.height !== content.payload.height) {
        found.push(`${content.id}: el contenido dice ${String(content.payload.width)}×${String(content.payload.height)} y el archivo mide ${dimensions.width}×${dimensions.height}`);
      }
      return found;
    },
  );
  problems.push(...techniqueChecks.flat());

  if (problems.length > 0) fail('Los datos generados no cumplen', problems);
}

// --- 5. Escritura -----------------------------------------------------------

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

// --- Programa ---------------------------------------------------------------

async function main(): Promise<void> {
  step('Leyendo data-src/dragon-ball/…');
  const src = await loadSrc();
  checkSrc(src);

  step('Dragon Ball API: personajes y transformaciones…');
  const [apiCharacters, apiTransformations] = await Promise.all([fetchApiCharacters(), fetchApiTransformations()]);
  const apiCharacterById = new Map(apiCharacters.map((character) => [character.id, character]));
  const apiTransformationById = new Map(apiTransformations.map((form) => [form.id, form]));

  step('Wiki en español: categorías de personajes por serie…');
  const members = await fetchSeriesMembers();
  step(`  ${SERIES.map((series) => `${series} ${members[series].size}`).join(' · ')} páginas`);

  // Lo curado tiene que seguir existiendo en las fuentes.
  const sourceProblems: string[] = [];
  const seriesByCharacter = new Map<string, SeriesId[]>();
  for (const character of src.characters) {
    if (character.api !== undefined && !apiCharacterById.has(character.api)) {
      sourceProblems.push(`${character.id}: el id ${character.api} ya no existe en Dragon Ball API`);
    }
    const series = seriesOfPage(character.wiki, members);
    if (series.length === 0) sourceProblems.push(`${character.id}: la página "${character.wiki}" no está en ninguna categoría de personajes por serie`);
    seriesByCharacter.set(character.id, series);
  }
  for (const form of src.transformations) {
    if (!apiTransformationById.has(form.api)) sourceProblems.push(`${form.id}: el id ${form.api} ya no existe en las transformaciones de Dragon Ball API`);
  }
  if (sourceProblems.length > 0) fail('Lo curado ya no coincide con las fuentes', sourceProblems);

  // Cronología de las series: la fijó quien mantiene el proyecto en sagas.json (db, dbz, super, gt, daima).
  const seriesRank = seriesRanks(src.sagas.seriesOrder);
  const sagaRank = sagaRanks(src.sagas);
  const sagaSeries = new Map(src.sagas.sagas.map((saga) => [saga.id, saga.series]));
  const debutOf = new Map<string, SeriesId>();
  for (const character of src.characters) debutOf.set(character.id, debutSeries(seriesByCharacter.get(character.id) ?? []));

  // Imágenes de personajes y formas
  step(`Imágenes de ${src.characters.length} personajes y ${src.transformations.length} formas…`);
  const characterImages = await mapPool(src.characters, IMAGE_TASKS, async (character): Promise<EntityImageResult> => {
    const api = character.sinImagen || character.api === undefined ? null : apiCharacterById.get(character.api);
    return entityImage(
      character.id,
      `dragon-ball/${character.id}`,
      path.join(MANUAL_DIR, 'characters'),
      IMAGE_DIR,
      api === null || api === undefined ? null : { url: api.image, cacheName: `characters/${api.id}-${apiFileName(api.image)}` },
    );
  });
  const formImages = await mapPool(src.transformations, IMAGE_TASKS, async (form): Promise<EntityImageResult> => {
    const api = apiTransformationById.get(form.api);
    return entityImage(
      form.id,
      `dragon-ball/transformations/${form.id}`,
      path.join(MANUAL_DIR, 'transformations'),
      FORM_IMAGE_DIR,
      api === undefined ? null : { url: api.image, cacheName: `transformations/${api.id}-${apiFileName(api.image)}` },
    );
  });

  // Imágenes de técnicas: solo las cargadas a mano
  step(`Imágenes de ${src.techniques.length} técnicas (solo las cargadas a mano)…`);
  const techniqueImages = await mapPool(src.techniques, IMAGE_TASKS, async (technique) => {
    const manual = await readManualImage(path.join(MANUAL_DIR, 'techniques'), technique.id);
    if (manual === null) return null;
    const rendered = await renderPlainImage(technique.id, manual.buffer, TECHNIQUE_IMAGE_DIR);
    const size = await imageDimensions(path.join(TECHNIQUE_IMAGE_DIR, imageFileName(technique.id, 512)));
    return { rendered, width: size.width, height: size.height };
  });

  step('Armando entidades y contenidos…');
  const powerById = new Map(src.power.map((entry) => [entry.id, entry]));
  const characters: Entity[] = src.characters.map((character, index) => {
    const series = seriesByCharacter.get(character.id) ?? [];
    const debut = debutOf.get(character.id) as SeriesId;
    return buildCharacterEntity({
      src: character,
      series: canonicalSeries(series),
      debutSeriesRank: seriesRank.get(debut) as number,
      debutSagaRank: sagaRank.get(character.sagaDebut) as number,
      power: powerById.get(character.id),
      image: characterImages[index].image,
    });
  });
  const characterById = new Map(src.characters.map((character) => [character.id, character]));
  const forms: Entity[] = src.transformations.map((form, index) =>
    buildTransformationEntity(form, (characterById.get(form.character) as CharacterSrc).name, formImages[index].image),
  );

  const orders = eventOrders(src.events, src.sagas.seriesOrder);
  const quotes: Content[] = src.quotes.map((quote) => ({
    id: `quote-${quote.id}`,
    kind: 'quote',
    entityId: quote.character,
    series: quote.series,
    payload: { text: quote.text, source: quote.source },
    verified: quote.verified,
  }));
  const events: Content[] = src.events.map((event) => buildEventContent(event, orders.get(event.id) as number));
  const techniques: Content[] = [];
  src.techniques.forEach((technique, index) => {
    const image = techniqueImages[index];
    if (image === null) return;
    techniques.push({
      id: `technique-${technique.id}`,
      kind: 'technique',
      entityId: technique.users[0],
      series: technique.series,
      payload: {
        name: technique.name,
        image: `dragon-ball/techniques/${technique.id}`,
        width: image.width,
        height: image.height,
        accepts: technique.users.slice(1),
      },
      verified: technique.verified,
    });
  });
  // Primero las frases y los sucesos, después las técnicas: agregar imágenes no reordena el resto.
  const contents = [...quotes, ...events, ...techniques];

  const sagasOutput = {
    series: src.sagas.seriesOrder.map((id) => ({ id, order: seriesRank.get(id) as number })),
    sagas: [...src.sagas.sagas]
      .map((saga) => ({ id: saga.id, name: saga.name, series: saga.series, order: sagaRank.get(saga.id) as number }))
      .sort((a, b) => a.order - b.order),
  };
  const sagasCheck = sagasOutputSchema.safeParse(sagasOutput);
  if (!sagasCheck.success) fail('sagas.json generado no cumple el esquema', [sagasCheck.error.message]);

  step('Validando…');
  await validate(src, characters, forms, contents, debutOf, sagaSeries);

  step('Escribiendo data/dragon-ball/…');
  await writeJson(path.join(DATA_DIR, 'entities.json'), characters);
  await writeJson(path.join(DATA_DIR, 'transformations.json'), forms);
  await writeJson(path.join(DATA_DIR, 'content.json'), contents);
  await writeJson(path.join(DATA_DIR, 'sagas.json'), sagasOutput);

  // Lo que falta cargar a mano
  const missingCharacters: MissingImage[] = src.characters
    .filter((_, index) => characterImages[index].image === null)
    .map((character) => ({
      id: character.id,
      name: character.name,
      file: `data-src/dragon-ball/images/characters/${character.id}`,
      wikiPage: character.wiki,
      note: character.sinImagen ? 'la de la API no es el personaje' : undefined,
    }));
  const missingTechniques: MissingImage[] = src.techniques
    .filter((_, index) => techniqueImages[index] === null)
    .map((technique) => ({
      id: technique.id,
      name: technique.name,
      file: `data-src/dragon-ball/images/techniques/${technique.id}`,
      wikiPage: technique.name,
      note: characterById.get(technique.users[0])?.name ?? technique.users[0],
    }));
  const techniqueAnswers = new Set(techniques.map((content) => content.entityId)).size;
  const opaque = [
    ...characters.filter((entity) => entity.attrs.imagenTransparente === 0),
    ...forms.filter((entity) => entity.attrs.imagenTransparente === 0),
  ].map((entity) => ({ id: entity.id, name: entity.name.es }));
  await writeTodoSection(
    TODO_FILE,
    renderTodoSection({
      characters: missingCharacters,
      techniques: missingTechniques,
      opaque,
      techniquePoolMinimum: TECHNIQUE_POOL_MINIMUM,
      techniqueAnswersWithImage: techniqueAnswers,
    }),
  );

  const imageBytesProject = await directoryBytes(IMG_ROOT);
  printReport({
    seriesOrder: src.sagas.seriesOrder,
    characters,
    forms,
    contents,
    sagaCount: src.sagas.sagas.length,
    rendered: {
      characters: characterImages.flatMap((result) => result.rendered),
      forms: formImages.flatMap((result) => result.rendered),
      techniques: techniqueImages.flatMap((result) => result?.rendered ?? []),
    },
    unverified: [
      { label: 'personajes', unverified: src.characters.filter((item) => !item.verified).length, total: src.characters.length },
      { label: 'formas', unverified: src.transformations.filter((item) => !item.verified).length, total: src.transformations.length },
      { label: 'técnicas', unverified: src.techniques.filter((item) => !item.verified).length, total: src.techniques.length },
      { label: 'frases', unverified: src.quotes.filter((item) => !item.verified).length, total: src.quotes.length },
      { label: 'sucesos', unverified: src.events.filter((item) => !item.verified).length, total: src.events.length },
    ],
    missing: { characters: missingCharacters.map((item) => item.id), techniques: missingTechniques.map((item) => item.id) },
    opaqueImages: opaque.map((item) => item.id),
    techniquesTotal: src.techniques.length,
    techniqueAnswers,
    powerWithValue: characters.filter((entity) => entity.attrs.ki !== null).length,
    powerOfficial: characters.filter((entity) => entity.attrs.kiOficial === 1).length,
    imageBytesDragonBall: await directoryBytes(IMAGE_DIR),
    imageBytesProject,
  });
  if (imageBytesProject > IMG_LIMIT_BYTES) {
    console.warn('AVISO: public/img supera los 150 MB de la SPEC (sección 7). Avisar antes de seguir.');
  }
  step('Listo.');
}

main().catch((error: unknown) => {
  console.error(`\nERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
