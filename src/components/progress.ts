import { STORAGE_PREFIX, readStats, type StorageLike } from '@/engine/storage';
import { isPracticeDay } from './game-shell/practice';

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
  filterKey?: string,
): Set<string> {
  const solved = new Set<string>();
  if (storage === null) return solved;
  const prefix = `${STORAGE_PREFIX}:state:${franchise}:`;
  const suffix = `:${day}`;
  try {
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (key === null || !key.startsWith(prefix) || !key.endsWith(suffix)) continue;
      // Las dificultades y los interruptores se guardan como `<filtros>~<variante>`.
      if (filterKey !== undefined && key.slice(prefix.length).split(':')[1]?.split('~')[0] !== filterKey) continue;
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

/**
 * Los modos terminados hoy sin ganar (algún intento perdido y ninguna victoria con ninguna combinación de filtros).
 * Se lee de las mismas partidas que `solvedToday`: `solvedToday` los suma a los ganados, y esto los distingue.
 */
export function lostToday(storage: KeyedStorage | null, franchise: string, modes: readonly string[], day: number): Set<string> {
  const lost = new Set<string>();
  if (storage === null) return lost;
  const won = wonToday(storage, franchise, modes, day);
  const prefix = `${STORAGE_PREFIX}:state:${franchise}:`;
  const suffix = `:${day}`;
  try {
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (key === null || !key.startsWith(prefix) || !key.endsWith(suffix)) continue;
      const mode = key.slice(prefix.length).split(':')[0];
      if (!modes.includes(mode) || won.has(mode)) continue;
      if (isFinished(storage, key)) lost.add(mode);
    }
  } catch {
    // Lo leído hasta el fallo alcanza.
  }
  return lost;
}

// --- Totales de todo el sitio (pestaña Estadísticas) -------------------------------------------------------------------

/**
 * Los días reales en que se ganó al menos un reto de cualquier franquicia o modo. Lee las mismas partidas guardadas que
 * `solvedToday` (las de práctica no cuentan: su "día" no es un día).
 */
export function winDays(storage: KeyedStorage | null): Set<number> {
  const days = new Set<number>();
  if (storage === null) return days;
  const prefix = `${STORAGE_PREFIX}:state:`;
  try {
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (key === null || !key.startsWith(prefix)) continue;
      const day = Number(key.slice(key.lastIndexOf(':') + 1));
      if (!Number.isInteger(day) || isPracticeDay(day) || days.has(day)) continue;
      if (wonAttempts(storage, key) !== null) days.add(day);
    }
  } catch {
    // Lo leído hasta el fallo alcanza.
  }
  return days;
}

/**
 * La racha vigente y la mejor de los días ganados: días seguidos con al menos un reto ganado. Igual que la de cada modo
 * (`activeStreak`), sigue viva si lo último ganado fue hoy o ayer, y se corta al pasar un día entero sin ganar.
 */
export function streaksOf(days: ReadonlySet<number>, today: number): { current: number; best: number } {
  const sorted = [...days].filter((day) => day <= today).sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let previous = Number.NEGATIVE_INFINITY;
  for (const day of sorted) {
    run = day === previous + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return { current: sorted.length > 0 && today - previous <= 1 ? run : 0, best };
}

export interface FranchiseTotals {
  readonly slug: string;
  readonly played: number;
  readonly won: number;
}

export interface SiteTotals {
  readonly played: number;
  readonly won: number;
  /** La mejor racha de un modo (la de cada modo se guarda aparte; esta es la máxima de todas). */
  readonly bestModeStreak: number;
  readonly franchises: readonly FranchiseTotals[];
}

/** Partidas jugadas y ganadas de todos los modos listados, sumadas por franquicia y en total. */
export function siteTotals(storage: StorageLike | null, franchises: ReadonlyArray<{ slug: string; modes: readonly string[] }>): SiteTotals {
  let played = 0;
  let won = 0;
  let bestModeStreak = 0;
  const perFranchise = franchises.map(({ slug, modes }) => {
    let franchisePlayed = 0;
    let franchiseWon = 0;
    for (const mode of modes) {
      const stats = readStats(storage, slug, mode);
      franchisePlayed += stats.played;
      franchiseWon += stats.won;
      bestModeStreak = Math.max(bestModeStreak, stats.maxStreak);
    }
    played += franchisePlayed;
    won += franchiseWon;
    return { slug, played: franchisePlayed, won: franchiseWon };
  });
  return { played, won, bestModeStreak, franchises: perFranchise };
}
