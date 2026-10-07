// npm run data:pokemon
//
// Genera el dataset base de Pokémon a partir de PokéAPI:
//   data/pokemon/entities.json   una entidad por especie base (sin megas ni formas regionales)
//   data/pokemon/content.json    descripciones de la Pokédex en español, con el nombre en "???"
//   public/img/pokemon/          arte oficial en WebP, 256 y 512 px
//
// Las respuestas de la API quedan en .cache/pokeapi/ (ignorada por git); la
// salida es determinista: ejecutarlo dos veces produce los mismos archivos.
// Si algo no cumple (esquema, ids repetidos, imágenes faltantes o fuera de
// presupuesto), falla sin escribir los JSON.

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Content, Entity } from '../../../src/engine/types.ts';
import { API_BASE, ROOT, getFile, getJson, mapPool } from './api.ts';
import { BUDGET_BYTES, SIZES, imageDimensions, imageFileName, renderImage, type Rendered } from './images.ts';
import { printReport } from './report.ts';
import {
  contentSchema,
  entitySchema,
  evolutionChainSchema,
  namedResourceSchema,
  pokemonSchema,
  speciesListSchema,
  speciesSchema,
  type PokemonData,
  type Species,
} from './schemas.ts';
import { buildDexContent, buildEntity, evolutionStages, mainAbilityUrl, nameIn } from './transform.ts';

const DATA_DIR = path.join(ROOT, 'data', 'pokemon');
const IMAGE_DIR = path.join(ROOT, 'public', 'img', 'pokemon');
const FETCH_TASKS = 16;
const IMAGE_TASKS = 4;

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

// --- 3. Validación ----------------------------------------------------------

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
  if (new Set(contents.map((content) => content.entityId)).size !== contents.length) {
    problems.push('hay más de una descripción para una misma entidad');
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

// --- Programa ---------------------------------------------------------------

async function main(): Promise<void> {
  const { species, apiCount } = await fetchSpecies();

  step('Formas por defecto…');
  const pokemon = await mapPool(species, FETCH_TASKS, (entry) => getJson(defaultPokemonUrl(entry), pokemonSchema));

  const stages = await fetchStages(species);
  const spanish = await fetchSpanishNames(species, pokemon);

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
    const content = buildDexContent(entry, entity);
    if (content) contents.push(content);
  });

  const rendered = await buildImages(species, pokemon);

  step('Validando…');
  await validate(entities, contents, apiCount);

  step('Escribiendo data/pokemon/…');
  await writeJson(path.join(DATA_DIR, 'entities.json'), entities);
  await writeJson(path.join(DATA_DIR, 'content.json'), contents);

  printReport({ entities, contents, apiSpeciesCount: apiCount, missingSpanishName, rendered });
  step('Listo.');
}

main().catch((error: unknown) => {
  console.error(`\nERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
