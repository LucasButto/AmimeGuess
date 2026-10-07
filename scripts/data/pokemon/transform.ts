// Transformaciones puras de los datos de PokéAPI a Entity y Content. Sin red ni
// disco: así se pueden probar solas (transform.test.ts).

import type { Content, Entity } from '../../../src/engine/types.ts';
import type { ChainLink, NameEntry, PokemonData, Species } from './schemas.ts';

// --- Generación y nombres ---------------------------------------------------

const GENERATIONS: Record<string, number> = {
  'generation-i': 1,
  'generation-ii': 2,
  'generation-iii': 3,
  'generation-iv': 4,
  'generation-v': 5,
  'generation-vi': 6,
  'generation-vii': 7,
  'generation-viii': 8,
  'generation-ix': 9,
};

export function generationNumber(apiName: string): number {
  const generation = GENERATIONS[apiName];
  if (generation === undefined) throw new Error(`Generación desconocida: ${apiName}`);
  return generation;
}

export function nameIn(names: readonly NameEntry[], language: string): string | undefined {
  return names.find((entry) => entry.language.name === language)?.name;
}

/** Algunos recursos de PokéAPI vienen en minúscula (hábitats) y otros capitalizados. */
export function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// --- Texto -------------------------------------------------------------------

/** Quita guiones suaves y saltos de línea o de página: deja el texto en una sola línea. */
export function cleanFlavorText(raw: string): string {
  return raw.replace(/­/g, '').replace(/\s+/g, ' ').trim();
}

function versionId(url: string): number {
  return Number(url.split('/').filter(Boolean).pop());
}

/**
 * La descripción en español de la versión más reciente que la tiene (mayor id
 * de versión en PokéAPI). Devuelve `undefined` si no hay ninguna.
 */
export function pickFlavorText(
  entries: Species['flavor_text_entries'],
): { text: string; version: string } | undefined {
  let best: { id: number; text: string; version: string } | undefined;
  for (const entry of entries) {
    if (entry.language.name !== 'es') continue;
    const text = cleanFlavorText(entry.flavor_text);
    if (text.length === 0) continue;
    const id = versionId(entry.version.url);
    if (best === undefined || id > best.id) best = { id, text, version: entry.version.name };
  }
  return best && { text: best.text, version: best.version };
}

// --- Enmascarar el nombre ---------------------------------------------------

const MASK = '???';

function foldChar(character: string): string {
  return character.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Minúsculas y sin acentos: "FLABÉBÉ" y "Flabebe" quedan iguales. */
function fold(text: string): string {
  return Array.from(text).map(foldChar).join('');
}

function isWordCharacter(character: string | undefined): boolean {
  return character !== undefined && /[\p{L}\p{N}]/u.test(character);
}

/** Formas en que el texto puede escribir el nombre: tal cual, sin ♀/♂ y con espacios en vez de guiones. */
export function nameVariants(names: readonly string[]): string[] {
  const variants = new Set<string>();
  for (const name of names) {
    variants.add(name);
    variants.add(name.replace(/[♀♂]/g, '').trim());
    variants.add(name.replace(/-/g, ' '));
  }
  return [...variants].filter((variant) => variant.length > 0);
}

/**
 * Reemplaza por "???" cada aparición del nombre como palabra completa, sin
 * distinguir mayúsculas ni acentos. No toca palabras que solo lo contienen
 * ("abrazo" no es "Abra").
 */
export function maskName(text: string, names: readonly string[]): string {
  const characters = Array.from(text);
  let folded = '';
  const owner: number[] = [];
  characters.forEach((character, index) => {
    const piece = foldChar(character);
    for (let unit = 0; unit < piece.length; unit++) owner.push(index);
    folded += piece;
  });

  // Los más largos primero, para que "mr. mime" gane a "mime".
  const needles = [...new Set(names.map(fold).filter((needle) => needle.length > 0))].sort(
    (a, b) => b.length - a.length || (a < b ? -1 : a > b ? 1 : 0),
  );

  const masked = new Array<boolean>(characters.length).fill(false);
  for (const needle of needles) {
    for (let from = folded.indexOf(needle); from !== -1; from = folded.indexOf(needle, from + 1)) {
      const to = from + needle.length;
      if (isWordCharacter(folded[from - 1]) || isWordCharacter(folded[to])) continue;
      for (let unit = from; unit < to; unit++) masked[owner[unit]] = true;
    }
  }

  let result = '';
  let inMask = false;
  characters.forEach((character, index) => {
    if (masked[index]) {
      if (!inMask) result += MASK;
      inMask = true;
    } else {
      result += character;
      inMask = false;
    }
  });
  return result;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Verificación independiente de `maskName`: ¿sigue apareciendo alguno de los
 * nombres como palabra completa? Usa una expresión regular en vez de recorrer
 * el texto, para no repetir el mismo error en las dos implementaciones.
 */
export function leaksName(text: string, names: readonly string[]): boolean {
  const haystack = fold(text);
  return names.some((name) => {
    const needle = fold(name);
    if (needle.length === 0) return false;
    return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(needle)}(?![\\p{L}\\p{N}])`, 'u').test(haystack);
  });
}

// --- Evolución --------------------------------------------------------------

/**
 * Etapa de cada especie sobre la cadena completa: la raíz es 1 (incluidos los
 * bebés), sus evoluciones 2, y así. No depende del filtro por generación.
 */
export function evolutionStages(root: ChainLink): Map<string, number> {
  const stages = new Map<string, number>();
  const visit = (link: ChainLink, depth: number): void => {
    stages.set(link.species.name, depth);
    for (const next of link.evolves_to) visit(next, depth + 1);
  };
  visit(root, 1);
  return stages;
}

// --- Atributos --------------------------------------------------------------

/** URL de la habilidad principal: la primera no oculta. */
export function mainAbilityUrl(abilities: PokemonData['abilities']): string {
  const ordered = [...abilities].sort((a, b) => a.slot - b.slot);
  const main = ordered.find((entry) => !entry.is_hidden) ?? ordered[0];
  if (main === undefined) throw new Error('El Pokémon no tiene habilidades');
  return main.ability.url;
}

const STAT_KEYS: Record<string, string> = {
  hp: 'ps',
  attack: 'ataque',
  defense: 'defensa',
  'special-attack': 'ataqueEspecial',
  'special-defense': 'defensaEspecial',
  speed: 'velocidad',
};

/** Estadísticas base con claves en español y su total. */
export function baseStats(stats: PokemonData['stats']): Record<string, number> {
  const result: Record<string, number> = {};
  let total = 0;
  for (const [apiName, key] of Object.entries(STAT_KEYS)) {
    const stat = stats.find((entry) => entry.stat.name === apiName);
    if (stat === undefined) throw new Error(`Falta la estadística ${apiName}`);
    result[key] = stat.base_stat;
    total += stat.base_stat;
  }
  result.totalEstadisticas = total;
  return result;
}

function buildAliases(spanish: string, english: string | undefined, slug: string): string[] {
  const seen = new Set([fold(spanish)]);
  const aliases: string[] = [];
  // "Farfetch’d" (apóstrofo tipográfico) también se tiene que poder buscar con el del teclado.
  const typedApostrophe = spanish.replace(/[’‘]/g, "'");
  for (const candidate of [english, typedApostrophe, slug]) {
    if (candidate === undefined) continue;
    const key = fold(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    aliases.push(candidate);
  }
  return aliases;
}

// --- Entity y Content -------------------------------------------------------

export interface EntityInput {
  species: Species;
  pokemon: PokemonData;
  /** Etapa evolutiva sobre la cadena completa. */
  stage: number;
  /** Nombre en español de un recurso de la API (tipo, color, hábitat, grupo huevo, habilidad), por URL. */
  spanish: (url: string) => string;
}

/** Ruta de la imagen dentro de /public/img, sin tamaño ni extensión: `pokemon/bulbasaur`. */
export function imageStem(id: string): string {
  return `pokemon/${id}`;
}

export function buildEntity({ species, pokemon, stage, spanish }: EntityInput): Entity {
  const english = nameIn(species.names, 'en');
  const spanishName = nameIn(species.names, 'es') ?? english ?? species.name;
  const generation = generationNumber(species.generation.name);

  const types = [...pokemon.types].sort((a, b) => a.slot - b.slot);
  const firstType = types[0];
  if (firstType === undefined) throw new Error(`${species.name} no tiene tipos`);

  return {
    id: species.name,
    name: english === undefined ? { es: spanishName } : { es: spanishName, en: english },
    aliases: buildAliases(spanishName, english, species.name),
    series: [`g${generation}`],
    image: imageStem(species.name),
    attrs: {
      tipo1: spanish(firstType.type.url),
      tipo2: types[1] ? spanish(types[1].type.url) : null,
      generacion: generation,
      colores: [spanish(species.color.url)],
      etapa: stage,
      // PokéAPI da la altura en decímetros y el peso en hectogramos.
      altura: pokemon.height / 10,
      peso: pokemon.weight / 10,
      habitat: species.habitat ? capitalizeFirst(spanish(species.habitat.url)) : null,
      gruposHuevo: species.egg_groups.map((group) => spanish(group.url)),
      habilidad: spanish(mainAbilityUrl(pokemon.abilities)),
      ...baseStats(pokemon.stats),
    },
  };
}

/**
 * La descripción de la Pokédex como contenido, con el nombre reemplazado por
 * "???". Viene tal cual de PokéAPI, sin redactar nada: por eso `verified: true`.
 * Devuelve `undefined` si la especie no tiene texto en español.
 */
export function buildDexContent(species: Species, entity: Entity): Content | undefined {
  const picked = pickFlavorText(species.flavor_text_entries);
  if (picked === undefined) return undefined;

  const names = nameVariants(
    [entity.name.es, entity.name.en, species.name, ...entity.aliases].filter((name): name is string => name !== undefined),
  );
  const text = maskName(picked.text, names);
  if (leaksName(text, names)) {
    throw new Error(`La descripción de ${species.name} sigue conteniendo su nombre: ${text}`);
  }

  return {
    id: `dex-${entity.id}`,
    kind: 'dex',
    entityId: entity.id,
    series: entity.series[0],
    payload: { text, version: picked.version },
    verified: true,
  };
}
