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
