import type { AttrValue, Content, Entity, SeriesId } from './types';

// Reglas de filtrado de la SPEC, sección 4. Las series se pasan siempre como
// listas de ids; el orden canónico de una franquicia es el de su config.

/** Clave de filtro cuando están activas todas las series. */
export const ALL_KEY = 'all';

/** Series activas sin repetidos ni ids desconocidos, en orden canónico. */
export function normalizeActiveSeries(
  requested: readonly SeriesId[],
  canonical: readonly SeriesId[],
): SeriesId[] {
  return canonical.filter((id) => requested.includes(id));
}

/**
 * Clave de filtro canónica: ids activos en orden canónico unidos con punto
 * (`g1.g2`), o `all` si están todas. No depende del orden en que se activaron.
 * Es también el valor del parámetro `s` de la URL. Regla 7: siempre tiene que
 * quedar al menos una serie activa.
 */
export function buildFilterKey(
  active: readonly SeriesId[],
  canonical: readonly SeriesId[],
): string {
  const normalized = normalizeActiveSeries(active, canonical);
  if (normalized.length === 0) {
    throw new RangeError('Tiene que haber al menos una serie activa');
  }
  return normalized.length === canonical.length ? ALL_KEY : normalized.join('.');
}

/**
 * Lee el parámetro `s`. Devuelve las series activas en orden canónico, o `null`
 * si falta o no es válido (vacío, con una serie desconocida): en ese caso el
 * llamador sigue con los filtros guardados o con todas las series.
 */
export function parseFilterKey(
  param: string | null | undefined,
  canonical: readonly SeriesId[],
): SeriesId[] | null {
  if (!param) return null;
  if (param === ALL_KEY) return [...canonical];
  const ids = param.split('.');
  if (ids.some((id) => !canonical.includes(id))) return null;
  return normalizeActiveSeries(ids, canonical);
}

/** Regla 1: una entidad es elegible si al menos una de sus series está activa. */
export function isEntityEligible(
  entity: Pick<Entity, 'series'>,
  active: readonly SeriesId[],
): boolean {
  return entity.series.some((id) => active.includes(id));
}

/** Regla 2: un contenido es elegible si su única serie está activa. */
export function isContentEligible(
  content: Pick<Content, 'series'>,
  active: readonly SeriesId[],
): boolean {
  return active.includes(content.series);
}

export function eligibleEntities<T extends Pick<Entity, 'series'>>(
  pool: readonly T[],
  active: readonly SeriesId[],
): T[] {
  return pool.filter((entity) => isEntityEligible(entity, active));
}

export function eligibleContents<T extends Pick<Content, 'series'>>(
  pool: readonly T[],
  active: readonly SeriesId[],
): T[] {
  return pool.filter((content) => isContentEligible(content, active));
}

/**
 * Regla 3: en un atributo de tipo conjunto se ocultan los valores etiquetados
 * con una serie inactiva. Los valores sin etiqueta se conservan siempre. Hay
 * que aplicarlo antes de comparar. Los atributos que no son listas pasan
 * sin cambios.
 */
export function filterAttrValue(value: AttrValue, active: readonly SeriesId[]): AttrValue {
  if (!Array.isArray(value)) return value;
  return value
    .filter((item) => typeof item === 'string' || item.series === undefined || active.includes(item.series))
    .map((item) => (typeof item === 'string' ? item : item.value));
}

/**
 * Regla 4: una entidad que pertenece a varios dueños (una carta de Yu-Gi-Oh)
 * hereda la unión de las series de todos ellos, en orden canónico.
 */
export function inheritSeries(
  ownerSeries: readonly (readonly SeriesId[])[],
  canonical: readonly SeriesId[],
): SeriesId[] {
  return normalizeActiveSeries(ownerSeries.flat(), canonical);
}

// Regla 6: tamaño mínimo de pool, salvo que el modo defina otro.
export const MIN_POOL_CLASSIC = 20;
export const MIN_POOL_DEFAULT = 10;
/** Para `connections` el mínimo se cuenta en grupos completos, no en entidades. */
export const MIN_POOL_CONNECTIONS = 4;

/** Mínimo de pool por defecto para un motor. */
export function defaultMinPool(engine: string): number {
  if (engine === 'classic') return MIN_POOL_CLASSIC;
  if (engine === 'connections') return MIN_POOL_CONNECTIONS;
  return MIN_POOL_DEFAULT;
}

/** Si no alcanza, el modo muestra un aviso y no se puede jugar con esa combinación. */
export function hasMinimumPool(size: number, minimum: number): boolean {
  return size >= minimum;
}
