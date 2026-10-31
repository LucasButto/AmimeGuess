'use client';

import { useSyncExternalStore } from 'react';
import { getLocalStorage } from '@/engine/storage';
import { DEFAULT_PREFS, LEGIBLE_FONT_ATTRIBUTE, PREFS_KEY, parsePrefs, writePrefs, type Prefs } from './prefs';

// --- Estado compartido ------------------------------------------------------
// Todas las partes de la página leen las mismas preferencias y se enteran al cambiarlas (también desde
// otra pestaña, con el evento `storage`).

const listeners = new Set<() => void>();
let cache: { raw: string | null; prefs: Prefs } | null = null;

function snapshot(): Prefs {
  let raw: string | null = null;
  try {
    raw = getLocalStorage()?.getItem(PREFS_KEY) ?? null;
  } catch {
    raw = null;
  }
  if (cache === null || cache.raw !== raw) cache = { raw, prefs: parsePrefs(raw) };
  return cache.prefs;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

/** Las preferencias actuales (las de por defecto en el servidor y antes de hidratar). */
export function usePrefs(): Prefs {
  return useSyncExternalStore(subscribe, snapshot, () => DEFAULT_PREFS);
}

/** Guarda las preferencias y avisa a todos los que las leen. */
export function setPrefs(prefs: Prefs): void {
  writePrefs(getLocalStorage(), prefs);
  document.documentElement.setAttribute('data-text-scale', String(prefs.textScale ?? 1));
  document.documentElement.toggleAttribute(LEGIBLE_FONT_ATTRIBUTE, prefs.legibleFont);
  for (const listener of listeners) listener();
}
