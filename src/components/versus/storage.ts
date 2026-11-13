import { STORAGE_PREFIX, getLocalStorage } from '@/engine/storage';

// Lo que el versus guarda en el navegador (docs/versus/02-arquitectura.md, "Almacenamiento en el navegador"). Nada de esto toca
// estadísticas, racha ni filtros guardados.

const NAME_KEY = `${STORAGE_PREFIX}:versus:name`;
const tokenKey = (code: string) => `${STORAGE_PREFIX}:versus:token:${code}`;

export interface Credentials {
  readonly playerId: string;
  readonly token: string;
}

/** El último apodo usado. */
export function readName(): string {
  try {
    return getLocalStorage()?.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function writeName(name: string): void {
  try {
    getLocalStorage()?.setItem(NAME_KEY, name);
  } catch {
    // Sin almacenamiento, el apodo no se recuerda.
  }
}

/** El lugar de este navegador en la sala (id y token), si ya había entrado. */
export function readCredentials(code: string): Credentials | null {
  try {
    const raw = getLocalStorage()?.getItem(tokenKey(code));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<Credentials>;
    return typeof value.playerId === 'string' && typeof value.token === 'string' ? { playerId: value.playerId, token: value.token } : null;
  } catch {
    return null;
  }
}

/** Se fue de la sala: el token ya no sirve. */
export function clearCredentials(code: string): void {
  try {
    globalThis.localStorage?.removeItem(tokenKey(code));
  } catch {
    // Sin almacenamiento, no hay nada que borrar.
  }
}

export function writeCredentials(code: string, credentials: Credentials): void {
  try {
    getLocalStorage()?.setItem(tokenKey(code), JSON.stringify(credentials));
  } catch {
    // Sin almacenamiento, al recargar habría que volver a entrar con el apodo.
  }
}

// --- Tiempos de las partidas ya terminadas (para el total acumulado de la barra) --------------------------------------------

const timesKey = (code: string) => `${STORAGE_PREFIX}:versus:times:${code}`;

/** Lo que tardó el jugador en cada partida que ya terminó de esta sala (se guarda en la pestaña: sobrevive a recargar). */
export function readTimes(code: string): Record<number, number> {
  try {
    const raw = globalThis.sessionStorage?.getItem(timesKey(code));
    const value = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    return Object.fromEntries(Object.entries(value).filter(([, ms]) => typeof ms === 'number').map(([index, ms]) => [Number(index), ms as number]));
  } catch {
    return {};
  }
}

export function writeTimes(code: string, times: Readonly<Record<number, number>>): void {
  try {
    globalThis.sessionStorage?.setItem(timesKey(code), JSON.stringify(times));
  } catch {
    // Sin almacenamiento, el total acumulado se reinicia al recargar.
  }
}

// --- Partidas guardadas de la sala ---------------------------------------------------------------------------------------------

/** Borra las partidas guardadas (`md:v1:state:…:<día>`) de los días de versus de una sala; no toca nada más. */
export function clearRoomGames(days: readonly number[]): void {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return;
    const wanted = new Set(days.map(String));
    const prefix = `${STORAGE_PREFIX}:state:`;
    const doomed: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(prefix) && wanted.has(key.slice(key.lastIndexOf(':') + 1))) doomed.push(key);
    }
    for (const key of doomed) storage.removeItem(key);
  } catch {
    // Sin almacenamiento no hay nada que borrar.
  }
}
