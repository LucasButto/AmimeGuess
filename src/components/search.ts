// Búsqueda del autocompletado: sin distinguir mayúsculas, acentos ni signos, y
// con coincidencia por nombre y por alias. Solo cuenta lo que EMPIEZA igual:
// con "s" salen los que empiezan con S, no los que llevan una S en cualquier
// parte. Lógica pura, sin React.

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
  return { compact: normalizeSearch(text), penalty };
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

/** 0: el nombre empieza igual · 3: un alias empieza igual. `null`: no coincide. */
function rank(key: Key, query: string): number | null {
  if (key.penalty > 0 && query.length < MIN_ALIAS_QUERY) return null;
  return key.compact.length > 0 && key.compact.startsWith(query) ? key.penalty : null;
}

export interface SearchOptions {
  /** Ids que no se ofrecen (por ejemplo, los ya intentados). */
  exclude?: ReadonlySet<string>;
  limit?: number;
}

/** Los que empiezan igual que `query`: primero por nombre, después por alias, y alfabéticamente. Sin texto, ninguno. */
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
