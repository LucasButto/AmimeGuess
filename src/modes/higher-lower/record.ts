import { STORAGE_PREFIX, type StorageLike } from '@/engine/storage';

/** El récord infinito se compara solo entre partidas con la misma medida y filtros. */
export function recordKey(franchise: string, mode: string, active: readonly string[], metric: string): string {
  return `${STORAGE_PREFIX}:higher-lower-record:${franchise}:${mode}:${[...active].sort().join('.')}:${metric}`;
}

export function readRecord(storage: StorageLike | null, key: string): number {
  try {
    const value = Number(storage?.getItem(key));
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function saveRecord(storage: StorageLike | null, key: string, score: number): number {
  const best = Math.max(readRecord(storage, key), Number.isSafeInteger(score) && score >= 0 ? score : 0);
  try {
    storage?.setItem(key, String(best));
  } catch {
    // Sin almacenamiento, el récord se conserva en el estado de esta partida.
  }
  return best;
}
