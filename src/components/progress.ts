import { STORAGE_PREFIX, type StorageLike } from '@/engine/storage';

// Cuántos retos de hoy se resolvieron. Lee las partidas guardadas (SPEC 6): la clave de cada una es
// `md:v1:state:<franquicia>:<modo>:<filtros>:<día>`, así que un modo cuenta si alguna de sus partidas de
// hoy, con cualquier combinación de filtros, terminó. Es solo lectura; no toca nada del motor.

/** Lo mínimo que se usa de `Storage` para recorrer las claves; en los tests se reemplaza por uno en memoria. */
export interface KeyedStorage extends StorageLike {
  readonly length: number;
  key(index: number): string | null;
}

/** `localStorage` del navegador con su lista de claves, o `null` si no existe o está bloqueado. */
export function getKeyedStorage(): KeyedStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function isFinished(storage: KeyedStorage, key: string): boolean {
  try {
    const raw = storage.getItem(key);
    if (raw === null) return false;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return false;
    const { result } = value as { result?: unknown };
    return result === 'won' || result === 'lost';
  } catch {
    return false;
  }
}

/**
 * Los modos de la franquicia que ya se resolvieron hoy (ganados o perdidos, no los que están a medias).
 * `modes` limita el conteo a los que se pueden jugar: una partida de un modo que ya no existe no suma.
 */
export function solvedToday(
  storage: KeyedStorage | null,
  franchise: string,
  modes: readonly string[],
  day: number,
): Set<string> {
  const solved = new Set<string>();
  if (storage === null) return solved;
  const prefix = `${STORAGE_PREFIX}:state:${franchise}:`;
  const suffix = `:${day}`;
  try {
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (key === null || !key.startsWith(prefix) || !key.endsWith(suffix)) continue;
      // `<modo>:<filtros>:<día>` → el modo es lo primero; los filtros llevan puntos, nunca dos puntos.
      const mode = key.slice(prefix.length).split(':')[0];
      if (modes.includes(mode) && !solved.has(mode) && isFinished(storage, key)) solved.add(mode);
    }
  } catch {
    // El almacenamiento puede fallar a mitad de la lectura: lo contado hasta ahí alcanza.
  }
  return solved;
}

/** Intentos de una partida guardada si está ganada (la longitud de `attempts`), o `null`. */
function wonAttempts(storage: KeyedStorage, key: string): number | null {
  try {
    const raw = storage.getItem(key);
    if (raw === null) return null;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const { result, attempts } = value as { result?: unknown; attempts?: unknown };
    return result === 'won' && Array.isArray(attempts) ? attempts.length : null;
  } catch {
    return null;
  }
}

/**
 * Los intentos con que se ganó hoy cada modo resuelto (con varias combinaciones de filtros, la de menos
 * intentos). Solo lee las mismas partidas que `solvedToday`, sin claves nuevas. Un modo terminado sin
 * ganar no aparece.
 */
export function wonToday(storage: KeyedStorage | null, franchise: string, modes: readonly string[], day: number): Map<string, number> {
  const won = new Map<string, number>();
  if (storage === null) return won;
  const prefix = `${STORAGE_PREFIX}:state:${franchise}:`;
  const suffix = `:${day}`;
  try {
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (key === null || !key.startsWith(prefix) || !key.endsWith(suffix)) continue;
      const mode = key.slice(prefix.length).split(':')[0];
      if (!modes.includes(mode)) continue;
      const attempts = wonAttempts(storage, key);
      if (attempts !== null) won.set(mode, Math.min(attempts, won.get(mode) ?? attempts));
    }
  } catch {
    // Lo leído hasta el fallo alcanza.
  }
  return won;
}
