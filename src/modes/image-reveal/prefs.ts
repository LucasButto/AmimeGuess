// Los dos interruptores de dificultad del motor `image-reveal` (SPEC 9) y su
// persistencia. Se guardan por franquicia y modo, así que se puede jugar Silueta
// en difícil y Zoom en fácil. Como el resto de la persistencia (SPEC 6): sin
// cuentas, en localStorage, con cada lectura y escritura protegida por try/catch.

import { STORAGE_PREFIX, type StorageLike } from '@/engine/storage';

export interface RevealPrefs {
  /** Cada intento fallido revela un paso más. Apagado, la imagen no cambia hasta acertar. */
  readonly reveal: boolean;
  /** Se ve a color. Apagado, todo lo que no es la imagen entera sale en grises. */
  readonly colors: boolean;
}

/** Lo más fácil: es lo que ve quien juega por primera vez. */
export const DEFAULT_PREFS: RevealPrefs = { reveal: true, colors: true };

export function prefsKey(franchise: string, mode: string): string {
  return `${STORAGE_PREFIX}:prefs:${franchise}:${mode}`;
}

/** Los interruptores guardados; los que falten o estén dañados vuelven a su valor por defecto. */
export function readPrefs(storage: StorageLike | null, franchise: string, mode: string): RevealPrefs {
  if (!storage) return DEFAULT_PREFS;
  try {
    const raw = storage.getItem(prefsKey(franchise, mode));
    const value: unknown = raw === null ? null : JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return DEFAULT_PREFS;
    const { reveal, colors } = value as Record<string, unknown>;
    return {
      reveal: typeof reveal === 'boolean' ? reveal : DEFAULT_PREFS.reveal,
      colors: typeof colors === 'boolean' ? colors : DEFAULT_PREFS.colors,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function writePrefs(storage: StorageLike | null, franchise: string, mode: string, prefs: RevealPrefs): boolean {
  if (!storage) return false;
  try {
    storage.setItem(prefsKey(franchise, mode), JSON.stringify(prefs));
    return true;
  } catch {
    return false;
  }
}
