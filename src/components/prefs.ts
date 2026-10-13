import { STORAGE_PREFIX, type StorageLike } from '@/engine/storage';

// Preferencias de interfaz (SPEC 6 y 9.2), en `md:v1:prefs`: "Fuente legible" y "Sonidos", las dos
// apagadas por defecto. Lectura y escritura protegidas: sin almacenamiento, valen los valores por defecto.
// Sin React: el layout raíz (servidor) importa de acá el script de arranque. El estado compartido entre
// componentes está en usePrefs.ts.

export interface Prefs {
  /** Reemplaza las fuentes del tema por una de sistema muy legible. */
  readonly legibleFont: boolean;
  /** Efectos de sonido cortos (Web Audio). */
  readonly sounds: boolean;
}

export const PREFS_KEY = `${STORAGE_PREFIX}:prefs`;
export const DEFAULT_PREFS: Prefs = { legibleFont: false, sounds: false };

/** Atributo de `<html>` que activa la fuente legible (ver globals.scss). */
export const LEGIBLE_FONT_ATTRIBUTE = 'data-legible-font';

/** Las preferencias guardadas; cualquier valor raro vuelve al valor por defecto, campo por campo. */
export function parsePrefs(raw: string | null): Prefs {
  if (raw === null) return DEFAULT_PREFS;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return DEFAULT_PREFS;
    const { legibleFont, sounds } = value as Record<string, unknown>;
    return { legibleFont: legibleFont === true, sounds: sounds === true };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function readPrefs(storage: StorageLike | null): Prefs {
  try {
    return parsePrefs(storage?.getItem(PREFS_KEY) ?? null);
  } catch {
    return DEFAULT_PREFS;
  }
}

export function writePrefs(storage: StorageLike | null, prefs: Prefs): void {
  try {
    storage?.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Almacenamiento lleno o bloqueado: la preferencia vale solo hasta recargar.
  }
}

/**
 * Script que va al principio del `<body>`: aplica la fuente legible antes de pintar, así no se ve un
 * instante la fuente del tema. Repite a mano lo que hace `parsePrefs` (corre antes que React).
 */
export const PREFS_BOOT_SCRIPT = `try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(PREFS_KEY)})||'{}');if(p&&p.legibleFont===true)document.documentElement.setAttribute(${JSON.stringify(LEGIBLE_FONT_ATTRIBUTE)},'')}catch(e){}`;
