/** Romanización de la interfaz sin macrones; conserva acentos españoles y referencias de las fuentes. */
export function plainDisplayText<T>(value: T): T {
  const walk = (item: unknown): unknown => {
    if (typeof item === 'string') return /^https?:\/\//.test(item) ? item : item.normalize('NFD').replace(/\u0304/g, '').normalize('NFC');
    if (Array.isArray(item)) return item.map(walk);
    if (item && typeof item === 'object') return Object.fromEntries(Object.entries(item).map(([key, entry]) => [key, walk(entry)]));
    return item;
  };
  return walk(value) as T;
}
