'use client';

import { useSyncExternalStore } from 'react';

// "Teléfono" es todo lo que está por debajo de `lg` (SPEC 9.3): la misma raya que usan los estilos (`min-width('lg')`).
const PHONE_QUERY = '(max-width: 63.99rem)';

function subscribe(listener: () => void): () => void {
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}

/** ¿La ventana está por debajo de `lg`? En el servidor y al hidratar vale `false` (el diseño de escritorio), y se corrige enseguida. */
export function useIsPhone(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(PHONE_QUERY).matches, () => false);
}
