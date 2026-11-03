'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(listener: () => void): () => void {
  const query = window.matchMedia(QUERY);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}

/** ¿La persona pidió menos movimiento? En el servidor y al hidratar vale `false`, y se corrige enseguida. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
