import { STORAGE_PREFIX } from '@/engine/storage';
import { isVersusDay } from '@/versus/seed';

// Modo infinito: partidas extra de un modo, con los mismos filtros, después de terminar el reto del día.
// Cada partida es un reto más del mismo motor: en lugar del número de un día real (el día 0 es el 2026-01-01, así que
// hoy va por unos cientos) usa un "día" de práctica, un número enorme elegido al empezar. El reto sale de
// (franquicia, modo, filtros, ese número) y del dataset. La sesión también indica `practice` para que
// Mayor o Menor pueda extender la secuencia y conservar su récord sin cambiar las estadísticas diarias.

/** Desde acá un número es un día de práctica; ningún día real llega ni cerca. */
export const PRACTICE_FROM = 1_000_000;
const PRACTICE_SPAN = 1_000_000_000;

/** Los días de versus (2.000.000.000 en adelante) no son de práctica: limpiar el modo infinito no borra las salas. */
export function isPracticeDay(day: number): boolean {
  return day >= PRACTICE_FROM && !isVersusDay(day);
}

/** El "día" de una partida nueva del modo infinito: al azar, para que no se repitan las partidas. */
export function newPracticeDay(): number {
  const buffer = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buffer);
  return PRACTICE_FROM + (buffer[0] % PRACTICE_SPAN);
}

// --- Sin repetir hasta completar todos ----------------------------------------------------------------------------------------
// El "día" de práctica es al azar, así que dos partidas seguidas podían caer en el mismo reto (la misma técnica tres veces en cuatro
// partidas). Ahora cada partida nueva busca un día cuyo reto todavía no se jugó: del reto solo se guarda una huella corta (de su
// respuesta, por lo que el marco ya sabe contar en "Ayer fue…"), por modo y combinación de filtros, y recién cuando salieron todos
// se vuelve a empezar. Los modos que no tienen una respuesta que se pueda nombrar (Mayor o Menor, Estadísticas, Categorías) siguen al azar.

/** Cuánto se busca un reto nuevo antes de dar por jugados todos los de este modo y estos filtros. */
const PICK_BUDGET_MS = 250;
const PICK_MAX_TRIES = 20_000;

/** La huella corta (FNV-1a de 32 bits, en base 36) de la respuesta de un reto: la que se guarda en lugar del texto. */
export function practiceKeyOf(info: { readonly label: string; readonly detail?: string; readonly imageStem?: string }): string {
  let hash = 0x811c9dc5;
  for (const char of `${info.label}|${info.detail ?? ''}|${info.imageStem ?? ''}`) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

export interface PracticePick {
  /** El día de práctica de la partida nueva. */
  readonly day: number;
  /** La huella de su reto, o `null` si el modo no tiene una respuesta que se pueda nombrar (entonces es solo al azar). */
  readonly key: string | null;
  /** No se encontró ninguno sin jugar: salieron todos, y con este empieza una vuelta nueva. */
  readonly exhausted: boolean;
}

interface PickOptions {
  readonly now?: () => number;
  readonly nextDay?: () => number;
  readonly budgetMs?: number;
  readonly maxTries?: number;
}

/** Busca al azar un día cuyo reto no esté en `seen`; `null` si pasa el tiempo o los intentos sin encontrarlo. */
function searchUnseen(keyOf: (day: number) => string | null, seen: ReadonlySet<string>, options: PickOptions): PracticePick {
  const { now = () => performance.now(), nextDay = newPracticeDay, budgetMs = PICK_BUDGET_MS, maxTries = PICK_MAX_TRIES } = options;
  const started = now();
  let last: PracticePick | null = null;
  for (let tries = 0; tries < maxTries; tries++) {
    const day = nextDay();
    const key = keyOf(day);
    if (key === null || !seen.has(key)) return { day, key, exhausted: false };
    last = { day, key, exhausted: true };
    if (now() - started > budgetMs) break;
  }
  return last ?? { day: nextDay(), key: null, exhausted: false };
}

/**
 * Elige el día de una partida nueva: el primero al azar cuyo reto (`keyOf`, la huella de la respuesta de ese día) no está en `seen`.
 * Con un reto que no se puede nombrar (`null`) vale cualquier día. Si pasa el tiempo o los intentos sin encontrar uno sin jugar,
 * es que salieron todos los retos de este modo y estos filtros: empieza una vuelta nueva (`exhausted`), y el primer reto de la vuelta
 * nunca es el último de la anterior, para que no haya dos seguidos iguales (`seen` conserva el orden en que se jugaron).
 */
export function pickPracticeDay(keyOf: (day: number) => string | null, seen: ReadonlySet<string>, options: PickOptions = {}): PracticePick {
  const found = searchUnseen(keyOf, seen, options);
  if (!found.exhausted) return found;
  const lastPlayed = [...seen].at(-1);
  if (lastPlayed === undefined || seen.size < 2) return found;
  const again = searchUnseen(keyOf, new Set([lastPlayed]), options);
  return { ...again, exhausted: true };
}

/** Dónde se guardan los retos ya jugados de un modo y una combinación de filtros (con su variante, si tiene). */
export function practiceSeenKey(franchise: string, mode: string, filterKey: string): string {
  return `${STORAGE_PREFIX}:practice-seen:${franchise}:${mode}:${filterKey}`;
}

interface SeenStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Las huellas de los retos ya jugados (vacío sin almacenamiento o con datos que no sirven). */
export function readSeen(storage: SeenStorage | null, key: string): Set<string> {
  try {
    const raw = storage?.getItem(key);
    const value: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);
  } catch {
    return new Set();
  }
}

export function writeSeen(storage: SeenStorage | null, key: string, seen: ReadonlySet<string>): void {
  try {
    storage?.setItem(key, JSON.stringify([...seen]));
  } catch {
    // Sin almacenamiento, el modo infinito vuelve a ser solo al azar.
  }
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
