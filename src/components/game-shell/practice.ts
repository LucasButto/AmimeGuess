import { STORAGE_PREFIX } from '@/engine/storage';

// Modo infinito: partidas extra de un modo, con los mismos filtros, después de terminar el reto del día.
// Cada partida es un reto más del mismo motor: en lugar del número de un día real (el día 0 es el 2026-01-01, así que
// hoy va por unos cientos) usa un "día" de práctica, un número enorme elegido al empezar. El motor no se entera: el
// reto sale de (franquicia, modo, filtros, ese número) y del dataset, como siempre.

/** Desde acá un número es un día de práctica; ningún día real llega ni cerca. */
export const PRACTICE_FROM = 1_000_000;
const PRACTICE_SPAN = 1_000_000_000;

export function isPracticeDay(day: number): boolean {
  return day >= PRACTICE_FROM;
}

/** El "día" de una partida nueva del modo infinito: al azar, para que no se repitan las partidas. */
export function newPracticeDay(): number {
  const buffer = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buffer);
  return PRACTICE_FROM + (buffer[0] % PRACTICE_SPAN);
}

/** Lo mínimo que se usa de `Storage` para recorrer y borrar claves. */
export interface KeyedStorage {
  readonly length: number;
  key(index: number): string | null;
  removeItem(key: string): void;
}

/** El almacenamiento del navegador para recorrer claves, o `null` si no existe o está bloqueado. */
export function practiceStorage(): KeyedStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Borra las partidas de práctica guardadas: cada una deja una clave y no sirven para nada una vez terminadas. */
export function clearPracticeStates(storage: KeyedStorage | null): void {
  if (!storage) return;
  try {
    const prefix = `${STORAGE_PREFIX}:state:`;
    const stale: string[] = [];
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (key?.startsWith(prefix) && isPracticeDay(Number(key.slice(key.lastIndexOf(':') + 1)))) stale.push(key);
    }
    for (const key of stale) storage.removeItem(key);
  } catch {
    // Sin almacenamiento no hay nada que limpiar.
  }
}
