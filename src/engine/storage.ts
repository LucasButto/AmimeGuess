import type { DailyContext } from './daily';
import type { SeriesId } from './types';

// Persistencia local (SPEC sección 6). Sin cuentas: todo en localStorage, con
// cada lectura y escritura protegida por try/catch, porque el almacenamiento
// puede estar bloqueado (modo privado, cookies deshabilitadas) o lleno. Un
// fallo nunca rompe el juego: leer devuelve el valor por defecto y escribir
// devuelve `false`.

/** Prefijo de todas las claves. Cambiarlo hace que se pierdan los datos ya guardados. */
export const STORAGE_PREFIX = 'md:v1';

/** Lo mínimo que se usa de `Storage`; en los tests se reemplaza por uno en memoria. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** `localStorage` del navegador, o `null` si no existe o está bloqueado. */
export function getLocalStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

// --- Claves -----------------------------------------------------------------

export function filtersKey(franchise: string): string {
  return `${STORAGE_PREFIX}:filters:${franchise}`;
}

export function stateKey(ctx: DailyContext): string {
  return `${STORAGE_PREFIX}:state:${ctx.franchise}:${ctx.mode}:${ctx.filterKey}:${ctx.day}`;
}

export function statsKey(franchise: string, mode: string): string {
  return `${STORAGE_PREFIX}:stats:${franchise}:${mode}`;
}

// --- Lectura y escritura seguras --------------------------------------------

function readJson(storage: StorageLike | null, key: string): unknown {
  if (!storage) return undefined;
  try {
    const raw = storage.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function writeJson(storage: StorageLike | null, key: string, value: unknown): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

// --- Filtros ----------------------------------------------------------------

/**
 * Series activas guardadas para una franquicia, o `null` si no hay o están
 * dañadas. Quien las use debe normalizarlas contra las series de la franquicia.
 */
export function readFilters(storage: StorageLike | null, franchise: string): SeriesId[] | null {
  const value = readJson(storage, filtersKey(franchise));
  if (!Array.isArray(value) || value.length === 0) return null;
  return value.every((id) => typeof id === 'string') ? (value as SeriesId[]) : null;
}

export function writeFilters(
  storage: StorageLike | null,
  franchise: string,
  active: readonly SeriesId[],
): boolean {
  return writeJson(storage, filtersKey(franchise), active);
}

// --- Estado de una partida --------------------------------------------------

export type GameResult = 'playing' | 'won' | 'lost';

/** Intentos y resultado de la partida de un día. Qué es un intento lo define cada motor. */
export interface GameState {
  attempts: unknown[];
  result: GameResult;
}

function isGameState(value: unknown): value is GameState {
  return (
    isRecord(value) &&
    Array.isArray(value.attempts) &&
    (value.result === 'playing' || value.result === 'won' || value.result === 'lost')
  );
}

export function readState(storage: StorageLike | null, ctx: DailyContext): GameState | null {
  const value = readJson(storage, stateKey(ctx));
  return isGameState(value) ? value : null;
}

export function writeState(storage: StorageLike | null, ctx: DailyContext, state: GameState): boolean {
  return writeJson(storage, stateKey(ctx), state);
}

// --- Estadísticas y racha ---------------------------------------------------

export interface Stats {
  /** Partidas terminadas, ganadas o perdidas. */
  played: number;
  won: number;
  /** Cantidad de victorias por cantidad de intentos: `{ "3": 2, "5": 1 }`. */
  distribution: Record<string, number>;
  /** Racha al momento de la última victoria; para mostrarla usar `activeStreak`. */
  currentStreak: number;
  maxStreak: number;
  /** Día de la última victoria, con cualquier filtro. */
  lastWonDay: number | null;
}

export function emptyStats(): Stats {
  return { played: 0, won: 0, distribution: {}, currentStreak: 0, maxStreak: 0, lastWonDay: null };
}

function isStats(value: unknown): value is Stats {
  return (
    isRecord(value) &&
    isCount(value.played) &&
    isCount(value.won) &&
    isRecord(value.distribution) &&
    Object.values(value.distribution).every(isCount) &&
    isCount(value.currentStreak) &&
    isCount(value.maxStreak) &&
    (value.lastWonDay === null || typeof value.lastWonDay === 'number')
  );
}

/** Estadísticas guardadas de un modo; si faltan o están dañadas, las de una persona nueva. */
export function readStats(storage: StorageLike | null, franchise: string, mode: string): Stats {
  const value = readJson(storage, statsKey(franchise, mode));
  return isStats(value) ? value : emptyStats();
}

export function writeStats(
  storage: StorageLike | null,
  franchise: string,
  mode: string,
  stats: Stats,
): boolean {
  return writeJson(storage, statsKey(franchise, mode), stats);
}

/** Resultado de una partida terminada. `attempts` solo cuenta en las victorias. */
export interface Outcome {
  day: number;
  won: boolean;
  attempts: number;
}

/**
 * Suma una partida terminada a las estadísticas, sin modificar las originales.
 *
 * La racha cuenta días, no partidas: un día suma si se ganó al menos un reto
 * de ese modo, con cualquier filtro. Ganar un segundo reto el mismo día no la
 * vuelve a sumar, y una derrota no la corta por sí sola (la corta pasar un día
 * entero sin ganar, ver `activeStreak`). Una victoria con un día anterior a la
 * última victoria (reloj atrasado) no toca la racha.
 */
export function applyResult(stats: Stats, outcome: Outcome): Stats {
  const played = stats.played + 1;
  if (!outcome.won) return { ...stats, played };

  const attemptsKey = String(outcome.attempts);
  const distribution = { ...stats.distribution, [attemptsKey]: (stats.distribution[attemptsKey] ?? 0) + 1 };

  let { currentStreak, lastWonDay } = stats;
  if (lastWonDay === null || outcome.day > lastWonDay) {
    currentStreak = lastWonDay !== null && outcome.day === lastWonDay + 1 ? currentStreak + 1 : 1;
    lastWonDay = outcome.day;
  }

  return {
    played,
    won: stats.won + 1,
    distribution,
    currentStreak,
    maxStreak: Math.max(stats.maxStreak, currentStreak),
    lastWonDay,
  };
}

/**
 * Racha vigente en el día `today`: la guardada si la última victoria fue hoy o
 * ayer, y 0 si pasó un día entero sin ganar.
 */
export function activeStreak(stats: Stats, today: number): number {
  return stats.lastWonDay !== null && today - stats.lastWonDay <= 1 ? stats.currentStreak : 0;
}

/** Lee las estadísticas, suma la partida y las guarda. Devuelve las nuevas aunque no se pudieran guardar. */
export function recordResult(
  storage: StorageLike | null,
  franchise: string,
  mode: string,
  outcome: Outcome,
): Stats {
  const updated = applyResult(readStats(storage, franchise, mode), outcome);
  writeStats(storage, franchise, mode, updated);
  return updated;
}
