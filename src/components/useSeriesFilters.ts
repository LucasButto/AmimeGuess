'use client';

import { useCallback, useEffect, useState } from 'react';
import { buildFilterKey, normalizeActiveSeries, parseFilterKey } from '@/engine/filters';
import { getLocalStorage, readFilters, writeFilters } from '@/engine/storage';

interface ResolveInput {
  /** Valor del parámetro `s` de la URL, si hay. */
  param: string | null;
  /** Series guardadas para la franquicia, si hay. */
  saved: readonly string[] | null;
  canonical: readonly string[];
}

/**
 * Qué series arrancan activas (SPEC 5, "Jugar juntos"): primero el parámetro
 * `s` de la URL, después lo guardado y, si no hay nada válido, todas.
 */
export function resolveActiveSeries({ param, saved, canonical }: ResolveInput): string[] {
  const fromUrl = parseFilterKey(param, canonical);
  if (fromUrl) return fromUrl;

  const fromStorage = saved ? normalizeActiveSeries(saved, canonical) : [];
  if (fromStorage.length > 0) return fromStorage;

  return [...canonical];
}

/**
 * Series activas de una franquicia. Las resuelve al montarse y mantiene el
 * parámetro `s` de la URL siempre al día, así copiar la dirección ya comparte
 * la combinación. Solo se guardan en `localStorage` los cambios que hace la
 * persona: abrir un link ajeno no pisa sus filtros.
 *
 * Lee `window`, por lo que tiene que usarse en componentes que solo se montan
 * en el cliente, después de la hidratación (ver `ModeGame`).
 */
export function useSeriesFilters(franchise: string, canonical: readonly string[]) {
  const [active, setActiveState] = useState<string[]>(() =>
    resolveActiveSeries({
      param: new URLSearchParams(window.location.search).get('s'),
      saved: readFilters(getLocalStorage(), franchise),
      canonical,
    }),
  );
  const filterKey = buildFilterKey(active, canonical);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('s') === filterKey) return;
    url.searchParams.set('s', filterKey);
    window.history.replaceState(window.history.state, '', url);
  }, [filterKey]);

  const setActive = useCallback(
    (next: readonly string[]) => {
      const normalized = normalizeActiveSeries(next, canonical);
      if (normalized.length === 0) return; // Regla 7: siempre al menos una serie.
      setActiveState(normalized);
      writeFilters(getLocalStorage(), franchise, normalized);
    },
    [canonical, franchise],
  );

  return { active, filterKey, setActive };
}
