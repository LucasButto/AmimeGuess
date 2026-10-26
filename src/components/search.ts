// Búsqueda del autocompletado: sin distinguir mayúsculas, acentos ni signos, y
// con coincidencia por nombre y por alias. Primero lo que EMPIEZA igual, después
// lo que tiene una palabra que empieza igual ("sar" → Hiruzen Sarutobi) y al final
// lo que lo contiene en cualquier parte ("chu" → Pikachu). Con una sola letra no
// cuenta lo de "cualquier parte": con "s" no salen los que llevan una S adentro.
// Lógica pura, sin React.

export interface SearchItem {
  id: string;
  label: string;
  aliases?: readonly string[];
}

/** "Mr. Mime", "mr mime" y "MRMIME" dan lo mismo: minúsculas, sin acentos, signos ni espacios. */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .join('');
}

interface Key {
  compact: string;
  /** Cada palabra, normalizada: para encontrar "Sarutobi" en "Hiruzen Sarutobi". */
  words: string[];
  /** Un alias vale menos que el nombre: a igual coincidencia, el nombre sale primero. */
  penalty: number;
}

interface IndexEntry<T> {
  item: T;
  keys: Key[];
  sortKey: string;
}

export type SearchIndex<T extends SearchItem> = IndexEntry<T>[];

function toKey(text: string, penalty: number): Key {
  const words = text.split(/\s+/u).map(normalizeSearch).filter((word) => word.length > 0);
  return { compact: normalizeSearch(text), words, penalty };
}

/** Prepara los elementos una sola vez, para que cada tecla solo compare. */
export function buildSearchIndex<T extends SearchItem>(items: readonly T[]): SearchIndex<T> {
  return items.map((item) => ({
    item,
    keys: [toKey(item.label, 0), ...(item.aliases ?? []).map((alias) => toKey(alias, 3))],
    sortKey: normalizeSearch(item.label),
  }));
}

/**
 * Con menos letras que esto solo cuenta el nombre: con una sola letra tienen que salir los que
 * empiezan con ella, no los que se llaman así en otro idioma ("S" no debe traer a Colagrito por "Scream Tail").
 */
const MIN_ALIAS_QUERY = 2;

/** Con menos letras que esto no cuenta lo que contiene el texto en el medio de una palabra. */
const MIN_INNER_QUERY = 2;

/**
 * 0: el nombre empieza igual · 1: una palabra del nombre empieza igual · 2: el nombre lo contiene en cualquier parte. Un
 * alias suma 3 a cada caso. `null`: no coincide.
 */
function rank(key: Key, query: string): number | null {
  if (key.penalty > 0 && query.length < MIN_ALIAS_QUERY) return null;
  if (key.compact.length === 0) return null;
  if (key.compact.startsWith(query)) return key.penalty;
  if (key.words.some((word) => word.startsWith(query))) return key.penalty + 1;
  if (query.length >= MIN_INNER_QUERY && key.compact.includes(query)) return key.penalty + 2;
  return null;
}

export interface SearchOptions {
  /** Ids que no se ofrecen (por ejemplo, los ya intentados). */
  exclude?: ReadonlySet<string>;
  limit?: number;
}

/** Los que coinciden con `query`, de la mejor coincidencia a la peor (ver `rank`) y alfabéticamente. Sin texto, ninguno. */
export function search<T extends SearchItem>(index: SearchIndex<T>, query: string, options: SearchOptions = {}): T[] {
  const normalized = normalizeSearch(query);
  if (normalized.length === 0) return [];

  const matches: Array<{ item: T; rank: number; sortKey: string }> = [];
  for (const entry of index) {
    if (options.exclude?.has(entry.item.id)) continue;
    let best: number | null = null;
    for (const key of entry.keys) {
      const value = rank(key, normalized);
      if (value !== null && (best === null || value < best)) best = value;
    }
    if (best !== null) matches.push({ item: entry.item, rank: best, sortKey: entry.sortKey });
  }

  matches.sort((a, b) => a.rank - b.rank || (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));
  const limited = options.limit === undefined ? matches : matches.slice(0, options.limit);
  return limited.map((match) => match.item);
}
