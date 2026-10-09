// npm run data:pokemon
//
// Genera el dataset base de Pokémon a partir de PokéAPI y TCGdex:
//   data/pokemon/entities.json   una entidad por especie base (sin megas ni formas regionales)
//   data/pokemon/content.json    descripciones de la Pokédex en español, con el nombre en "???",
//                                cartas del TCG (kind "tcg-card", hasta 2 por Pokémon) y
//                                movimientos insignia (kind "signature-move") y el Moveset de
//                                cada Pokémon (kind "moveset": sus 4 movimientos menos comunes)
//   public/img/pokemon/          arte oficial en WebP, 256 y 512 px
//   public/img/pokemon/cards/    las cartas del TCG en WebP, 256 y 512 px
//
// Las respuestas de las APIs quedan en .cache/ (ignorada por git); la salida es
// determinista: ejecutarlo dos veces produce los mismos archivos. Si algo no
// cumple (esquema, ids repetidos, imágenes faltantes o fuera de presupuesto),
// falla sin escribir los JSON.

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Content, Entity } from '../../../src/engine/types.ts';
import { API_BASE, NotFoundError, ROOT, TCGDEX, TCGDEX_BASE, WIKIDEX, getFile, getJson, mapPool } from './api.ts';
import {
  CARDS_PER_POKEMON,
  CARD_DIRECTORY,
  buildCardContent,
  cardSlug,
  pickCards,
  type CardSource,
} from './cards.ts';
import {
  BUDGET_BYTES,
  CARD,
  SIZES,
  imageDimensions,
  imageFileName,
  renderImage,
  type Rendered,
} from './images.ts';
import { buildSignatureContents, countLearners, learnerPokemonId, type SignatureResult } from './moves.ts';
import { MOVES_PER_POKEMON, buildMovesetContents } from './moveset.ts';
import { printReport } from './report.ts';
import {
  contentSchema,
  entitySchema,
  evolutionChainSchema,
  moveListSchema,
  moveSchema,
  namedResourceSchema,
  pokemonSchema,
  pokemonSpeciesRefSchema,
  speciesListSchema,
  speciesSchema,
  tcgCardListSchema,
  tcgCardSchema,
  type Move,
  type PokemonData,
  type Species,
} from './schemas.ts';
import { buildDexContent, buildEntity, evolutionStages, mainAbilityUrl, nameIn, pickFlavorText } from './transform.ts';
import { wikidexDexText, wikidexParseSchema, wikidexUrl } from './wikidex.ts';

const DATA_DIR = path.join(ROOT, 'data', 'pokemon');
const IMAGE_DIR = path.join(ROOT, 'public', 'img', 'pokemon');
const CARD_IMAGE_DIR = path.join(ROOT, 'public', 'img', CARD_DIRECTORY);
const FETCH_TASKS = 16;
const IMAGE_TASKS = 4;
const WIKIDEX_TASKS = 2;

const started = Date.now();
const step = (message: string) => console.log(`[${((Date.now() - started) / 1000).toFixed(0).padStart(3)} s] ${message}`);

function unique<T>(items: Iterable<T>): T[] {
  return [...new Set(items)];
}

function idFromUrl(url: string): number {
  return Number(url.split('/').filter(Boolean).pop());
}

function fail(title: string, problems: string[]): never {
  const shown = problems.slice(0, 25).map((problem) => `  - ${problem}`);
  if (problems.length > shown.length) shown.push(`  … y ${problems.length - shown.length} más`);
  throw new Error(`${title} (${problems.length}):\n${shown.join('\n')}`);
}

// --- 1. Datos de la API -----------------------------------------------------

async function fetchSpecies(): Promise<{ species: Species[]; apiCount: number }> {
  const list = await getJson(`${API_BASE}/pokemon-species?limit=2000`, speciesListSchema);
  const entries = [...list.results].sort((a, b) => idFromUrl(a.url) - idFromUrl(b.url));
  step(`Especies en la API: ${list.count}. Descargando…`);
  const species = await mapPool(entries, FETCH_TASKS, (entry) => getJson(entry.url, speciesSchema));
  return { species, apiCount: list.count };
}

function defaultPokemonUrl(species: Species): string {
  const base = species.varieties.find((variety) => variety.is_default);
  if (base === undefined) throw new Error(`${species.name} no tiene forma por defecto`);
  return base.pokemon.url;
}

async function fetchStages(species: Species[]): Promise<Map<string, number>> {
  const urls = unique(species.map((entry) => entry.evolution_chain.url));
  step(`Cadenas evolutivas: ${urls.length}`);
  const chains = await mapPool(urls, FETCH_TASKS, (url) => getJson(url, evolutionChainSchema));
  const stages = new Map<string, number>();
  for (const chain of chains) {
    for (const [name, stage] of evolutionStages(chain.chain)) stages.set(name, stage);
  }
  return stages;
}

/** Nombres en español de tipos, colores, hábitats, grupos huevo y habilidades, por URL. */
async function fetchSpanishNames(species: Species[], pokemon: PokemonData[]): Promise<(url: string) => string> {
  const urls = unique([
    ...species.map((entry) => entry.color.url),
    ...species.flatMap((entry) => (entry.habitat ? [entry.habitat.url] : [])),
    ...species.flatMap((entry) => entry.egg_groups.map((group) => group.url)),
    ...pokemon.flatMap((entry) => entry.types.map((type) => type.type.url)),
    ...pokemon.map((entry) => mainAbilityUrl(entry.abilities)),
  ]);
  step(`Recursos con nombre (tipos, colores, hábitats, grupos huevo, habilidades): ${urls.length}`);

  const resources = await mapPool(urls, FETCH_TASKS, (url) => getJson(url, namedResourceSchema));
  const names = new Map<string, string>();
  const missing: string[] = [];
  urls.forEach((url, index) => {
    const spanish = nameIn(resources[index].names, 'es');
    if (spanish === undefined) missing.push(url);
    else names.set(url, spanish);
  });
  if (missing.length > 0) fail('Recursos sin nombre en español', missing);

  return (url) => {
    const name = names.get(url);
    if (name === undefined) throw new Error(`Falta el nombre en español de ${url}`);
    return name;
  };
}

// --- 1b. Movimientos --------------------------------------------------------

async function fetchMoves(): Promise<Move[]> {
  const list = await getJson(`${API_BASE}/move?limit=2000`, moveListSchema);
  const entries = [...list.results].sort((a, b) => idFromUrl(a.url) - idFromUrl(b.url));
  step(`Movimientos en la API: ${list.count}. Descargando…`);
  const moves = await mapPool(entries, FETCH_TASKS, (entry) => getJson(entry.url, moveSchema));
  if (moves.length !== list.count) throw new Error(`Se descargaron ${moves.length} movimientos y la API informa ${list.count}`);
  return moves;
}

/**
 * Nombre en español de los tipos de los movimientos. Algunos movimientos tienen un tipo interno sin
 * traducción (de otros juegos): solo es un problema si lo usa un movimiento insignia.
 */
async function fetchMoveTypeNames(moves: Move[]): Promise<(url: string) => string> {
  const urls = unique(moves.map((move) => move.type.url));
  const resources = await mapPool(urls, FETCH_TASKS, (url) => getJson(url, namedResourceSchema));
  const names = new Map<string, string>();
  urls.forEach((url, index) => {
    const spanishName = nameIn(resources[index].names, 'es');
    if (spanishName !== undefined) names.set(url, spanishName);
  });
  return (url) => {
    const name = names.get(url);
    if (name === undefined) throw new Error(`Falta el nombre en español del tipo ${url}`);
    return name;
  };
}

/**
 * A qué especie pertenece cada Pokémon que aparece como aprendiz. Las formas por defecto ya
 * están descargadas; las alternativas (Mega, regionales, Gigamax…) se piden una por una.
 */
async function fetchSpeciesOfPokemon(
  moves: Move[],
  species: Species[],
  pokemon: PokemonData[],
): Promise<(pokemonId: number) => number | undefined> {
  const known = new Map<number, number>(pokemon.map((entry, index) => [entry.id, species[index].id]));
  const missing = unique(moves.flatMap((move) => move.learned_by_pokemon.map(learnerPokemonId))).filter((id) => !known.has(id));
  step(`Formas alternativas que aprenden movimientos: ${missing.length}`);
  const forms = await mapPool(missing, FETCH_TASKS, (id) => getJson(`${API_BASE}/pokemon/${id}`, pokemonSpeciesRefSchema));
  for (const form of forms) known.set(form.id, idFromUrl(form.species.url));
  return (pokemonId) => known.get(pokemonId);
}

function signatureMoves(
  moves: Move[],
  species: Species[],
  entities: Entity[],
  speciesOf: (pokemonId: number) => number | undefined,
  spanish: (url: string) => string,
): SignatureResult {
  const entityBySpecies = new Map(species.map((entry, index) => [entry.id, entities[index]]));
  const chainBySpecies = new Map(species.map((entry) => [entry.id, idFromUrl(entry.evolution_chain.url)]));
  return buildSignatureContents({
    moves,
    speciesOf,
    chainOf: (speciesId) => {
      const chain = chainBySpecies.get(speciesId);
      if (chain === undefined) throw new Error(`La especie ${speciesId} no tiene cadena evolutiva`);
      return chain;
    },
    entityOf: (speciesId) => {
      const entity = entityBySpecies.get(speciesId);
      if (entity === undefined) throw new Error(`La especie ${speciesId} no tiene entidad`);
      return entity;
    },
    typeName: spanish,
  });
}

// --- 2. Imágenes ------------------------------------------------------------

async function buildImages(species: Species[], pokemon: PokemonData[]): Promise<Rendered[]> {
  const sources = species.map((entry, index) => ({
    id: entry.name,
    url: pokemon[index].sprites.other?.['official-artwork']?.front_default ?? null,
  }));

  const withoutArtwork = sources.filter((source) => source.url === null).map((source) => source.id);
  if (withoutArtwork.length > 0) fail('Especies sin arte oficial en PokéAPI', withoutArtwork);

  step(`Descargando arte oficial: ${sources.length} imágenes…`);
  const buffers = await mapPool(sources, FETCH_TASKS, (source) =>
    getFile(source.url as string, `official-artwork/${source.id}.png`),
  );

  step('Convirtiendo a WebP (256 y 512 px)…');
  const rendered = await mapPool(sources, IMAGE_TASKS, (source, index) =>
    renderImage(source.id, buffers[index], IMAGE_DIR),
  );
  return rendered.flat();
}

// --- 3. Cartas del TCG ------------------------------------------------------

interface CardsResult {
  contents: Content[];
  rendered: Rendered[];
  /** Pokémon para los que TCGdex no tiene ninguna carta que sirva. */
  withoutCard: string[];
}

/** Un recurso que no existe es `null` (se prueba con otra carta); cualquier otro fallo corta el script. */
async function orNull<T>(request: Promise<T>): Promise<T | null> {
  try {
    return await request;
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}

async function buildCards(species: Species[], entities: Entity[]): Promise<CardsResult> {
  step(`Cartas del TCG (TCGdex): eligiendo hasta ${CARDS_PER_POKEMON} por Pokémon…`);
  const source: CardSource = {
    detail: (id) => orNull(getJson(`${TCGDEX_BASE}/es/cards/${encodeURIComponent(id)}`, tcgCardSchema, TCGDEX)),
    image: (card) => orNull(getFile(`${card.image}/high.webp`, `cards/${cardSlug(card.id)}.webp`, TCGDEX)),
  };

  // El número de Pokédex nacional es el id de la especie en PokéAPI.
  const picks = await mapPool(entities, FETCH_TASKS, async (entity, index) => {
    const dex = species[index].id;
    const briefs = await getJson(`${TCGDEX_BASE}/es/cards?dexId=eq:${dex}`, tcgCardListSchema, TCGDEX);
    return pickCards(entity.id, dex, briefs, source);
  });

  const flat = entities.flatMap((entity, index) => picks[index].map((pick) => ({ entity, pick })));
  step(`Convirtiendo ${flat.length} cartas a WebP (256 y 512 px)…`);
  const built = await mapPool(flat, IMAGE_TASKS, async ({ entity, pick }) => {
    const slug = cardSlug(pick.card.id);
    const rendered = await renderImage(slug, pick.image, CARD_IMAGE_DIR, CARD);
    const size = await imageDimensions(path.join(CARD_IMAGE_DIR, imageFileName(slug, 512)));
    return { content: buildCardContent(entity, pick.card, size), rendered };
  });

  const withoutCard = entities.filter((_, index) => picks[index].length === 0).map((entity) => entity.id);
  return {
    contents: built.map((item) => item.content),
    rendered: built.flatMap((item) => item.rendered),
    withoutCard,
  };
}

// --- 3b. Descripciones de WikiDex --------------------------------------------

/**
 * Para las especies sin descripción en español en PokéAPI, la transcripción de
 * la plantilla {{Pokédex}} de WikiDex (ver wikidex.ts). La página se busca por
 * el nombre en español. Las que WikiDex tampoco tiene quedan sin descripción.
 */
async function fetchWikidexTexts(species: Species[]): Promise<Map<string, { text: string; version: string }>> {
  const missing = species.filter((entry) => pickFlavorText(entry.flavor_text_entries) === undefined);
  step(`Descripciones de WikiDex para ${missing.length} especies sin texto en PokéAPI…`);
  const texts = await mapPool(missing, WIKIDEX_TASKS, async (entry) => {
    const page = nameIn(entry.names, 'es') ?? nameIn(entry.names, 'en') ?? entry.name;
    return wikidexDexText(await getJson(wikidexUrl(page), wikidexParseSchema, WIKIDEX));
  });
  const found = new Map<string, { text: string; version: string }>();
  missing.forEach((entry, index) => {
    const text = texts[index];
    if (text !== undefined) found.set(entry.name, text);
  });
  return found;
}

// --- 4. Validación ----------------------------------------------------------

const REQUIRED_ATTRS = [
  'tipo1', 'tipo2', 'generacion', 'colores', 'etapa', 'altura', 'peso', 'habitat', 'gruposHuevo', 'habilidad',
  'ps', 'ataque', 'defensa', 'ataqueEspecial', 'defensaEspecial', 'velocidad', 'totalEstadisticas',
];

async function validate(entities: Entity[], contents: Content[], apiCount: number): Promise<void> {
  const problems: string[] = [];

  // Esquemas
  entities.forEach((entity) => {
    const result = entitySchema.safeParse(entity);
    if (!result.success) problems.push(`entidad ${entity.id}: ${result.error.message}`);
  });
  contents.forEach((content) => {
    const result = contentSchema.safeParse(content);
    if (!result.success) problems.push(`contenido ${content.id}: ${result.error.message}`);
  });

  // Cantidades y unicidad
  if (entities.length !== apiCount) problems.push(`hay ${entities.length} entidades y la API informa ${apiCount} especies`);
  const ids = new Set(entities.map((entity) => entity.id));
  if (ids.size !== entities.length) problems.push('hay ids de entidad repetidos');
  if (new Set(contents.map((content) => content.id)).size !== contents.length) problems.push('hay ids de contenido repetidos');
  const dexContents = contents.filter((content) => content.kind === 'dex');
  if (new Set(dexContents.map((content) => content.entityId)).size !== dexContents.length) {
    problems.push('hay más de una descripción para una misma entidad');
  }
  const cardContents = contents.filter((content) => content.kind === 'tcg-card');
  const cardIds = cardContents.map((content) => String(content.payload.cardId));
  if (new Set(cardIds).size !== cardIds.length) problems.push('una misma carta del TCG está asignada a más de un Pokémon');
  for (const entity of entities) {
    const count = cardContents.filter((content) => content.entityId === entity.id).length;
    if (count > CARDS_PER_POKEMON) problems.push(`${entity.id}: tiene ${count} cartas y el máximo es ${CARDS_PER_POKEMON}`);
  }
  const movesetContents = contents.filter((content) => content.kind === 'moveset');
  if (new Set(movesetContents.map((content) => content.entityId)).size !== movesetContents.length) {
    problems.push('hay más de un Moveset para una misma entidad');
  }
  for (const content of movesetContents) {
    const items = content.payload.items as string[];
    if (new Set(items).size !== MOVES_PER_POKEMON) problems.push(`${content.id}: tiene movimientos repetidos`);
  }
  for (const content of contents.filter((candidate) => candidate.kind === 'signature-move')) {
    for (const other of content.payload.accepts as string[]) {
      if (!ids.has(other)) problems.push(`${content.id}: acepta a ${other}, que no existe`);
      if (other === content.entityId) problems.push(`${content.id}: se acepta a sí mismo`);
    }
  }
  const series = new Set(entities.map((entity) => entity.series[0]));
  for (let generation = 1; generation <= 9; generation++) {
    if (!series.has(`g${generation}`)) problems.push(`no hay ninguna entidad de g${generation}`);
  }

  // Referencias y atributos
  const entityById = new Map(entities.map((entity) => [entity.id, entity]));
  for (const content of contents) {
    const owner = content.entityId === undefined ? undefined : entityById.get(content.entityId);
    if (owner === undefined) problems.push(`el contenido ${content.id} apunta a una entidad inexistente`);
    else if (owner.series[0] !== content.series) problems.push(`el contenido ${content.id} no tiene la serie de su entidad`);
  }
  for (const entity of entities) {
    for (const key of REQUIRED_ATTRS) {
      if (!(key in entity.attrs)) problems.push(`${entity.id}: falta el atributo ${key}`);
    }
    const { etapa, altura, peso } = entity.attrs;
    if (typeof etapa !== 'number' || !Number.isInteger(etapa) || etapa < 1) problems.push(`${entity.id}: etapa inválida (${String(etapa)})`);
    if (typeof altura !== 'number' || altura <= 0) problems.push(`${entity.id}: altura inválida (${String(altura)})`);
    if (typeof peso !== 'number' || peso <= 0) problems.push(`${entity.id}: peso inválido (${String(peso)})`);
  }

  // Imágenes en disco: las dos variantes, formato WebP, lado mayor exacto y dentro del presupuesto
  const imageChecks = await mapPool(entities, FETCH_TASKS, async (entity) => {
    const found: string[] = [];
    for (const size of SIZES) {
      const file = path.join(IMAGE_DIR, imageFileName(entity.id, size));
      try {
        const [{ size: bytes }, dimensions] = await Promise.all([stat(file), imageDimensions(file)]);
        if (dimensions.format !== 'webp') found.push(`${entity.id} (${size} px): no es WebP`);
        if (Math.max(dimensions.width, dimensions.height) !== size) {
          found.push(`${entity.id} (${size} px): mide ${dimensions.width}×${dimensions.height}`);
        }
        if (bytes > BUDGET_BYTES[size]) found.push(`${entity.id} (${size} px): pesa ${bytes} bytes`);
      } catch {
        found.push(`${entity.id} (${size} px): falta el archivo`);
      }
    }
    if (entity.image !== `pokemon/${entity.id}`) found.push(`${entity.id}: ruta de imagen inesperada (${String(entity.image)})`);
    return found;
  });
  problems.push(...imageChecks.flat());

  // Cartas: las dos variantes en disco, WebP, lado mayor exacto, dentro del presupuesto
  // de las cartas, y con las medidas del archivo de 512 px que guarda el contenido.
  const cardChecks = await mapPool(cardContents, FETCH_TASKS, async (content) => {
    const found: string[] = [];
    const stem = String(content.payload.image);
    for (const size of SIZES) {
      const file = path.join(ROOT, 'public', 'img', `${stem}-${size}.webp`);
      try {
        const [{ size: bytes }, dimensions] = await Promise.all([stat(file), imageDimensions(file)]);
        if (dimensions.format !== 'webp') found.push(`${content.id} (${size} px): no es WebP`);
        if (Math.max(dimensions.width, dimensions.height) !== size) {
          found.push(`${content.id} (${size} px): mide ${dimensions.width}×${dimensions.height}`);
        }
        if (bytes > CARD.budget[size]) found.push(`${content.id} (${size} px): pesa ${bytes} bytes`);
        if (size === 512 && (dimensions.width !== content.payload.width || dimensions.height !== content.payload.height)) {
          found.push(`${content.id}: el contenido dice ${String(content.payload.width)}×${String(content.payload.height)} y el archivo mide ${dimensions.width}×${dimensions.height}`);
        }
      } catch {
        found.push(`${content.id} (${size} px): falta el archivo`);
      }
    }
    return found;
  });
  problems.push(...cardChecks.flat());

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

// --- Programa ---------------------------------------------------------------

async function main(): Promise<void> {
  const { species, apiCount } = await fetchSpecies();

  step('Formas por defecto…');
  const pokemon = await mapPool(species, FETCH_TASKS, (entry) => getJson(defaultPokemonUrl(entry), pokemonSchema));

  const stages = await fetchStages(species);
  const moves = await fetchMoves();
  const speciesOfPokemon = await fetchSpeciesOfPokemon(moves, species, pokemon);
  const spanish = await fetchSpanishNames(species, pokemon);
  const moveTypeName = await fetchMoveTypeNames(moves);

  const wikidex = await fetchWikidexTexts(species);

  step('Armando entidades y descripciones…');
  const entities: Entity[] = [];
  const contents: Content[] = [];
  const missingSpanishName: string[] = [];
  species.forEach((entry, index) => {
    const stage = stages.get(entry.name);
    if (stage === undefined) throw new Error(`${entry.name} no aparece en su cadena evolutiva`);
    if (nameIn(entry.names, 'es') === undefined) missingSpanishName.push(entry.name);

    const entity = buildEntity({ species: entry, pokemon: pokemon[index], stage, spanish });
    entities.push(entity);
    const content = buildDexContent(entry, entity, wikidex.get(entry.name));
    if (content) contents.push(content);
  });

  const rendered = await buildImages(species, pokemon);
  const cards = await buildCards(species, entities);
  // Primero las descripciones y después las cartas, así agregar un tipo de contenido no reordena el resto.
  const signature = signatureMoves(moves, species, entities, speciesOfPokemon, moveTypeName);
  const moveset = buildMovesetContents({
    pokemon: entities.map((entity, index) => ({ entity, moves: pokemon[index].moves.map((entry) => entry.move.name) })),
    moves,
    learnerCount: countLearners(moves, speciesOfPokemon),
  });
  const allContents = [...contents, ...cards.contents, ...signature.contents, ...moveset.contents];

  step('Validando…');
  await validate(entities, allContents, apiCount);

  step('Escribiendo data/pokemon/…');
  await writeJson(path.join(DATA_DIR, 'entities.json'), entities);
  await writeJson(path.join(DATA_DIR, 'content.json'), allContents);

  printReport({
    entities,
    contents: allContents,
    apiSpeciesCount: apiCount,
    missingSpanishName,
    rendered,
    cardImages: cards.rendered,
    withoutCard: cards.withoutCard,
    signature,
    moveset,
  });
  step('Listo.');
}

main().catch((error: unknown) => {
  console.error(`\nERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
