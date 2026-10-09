// Cliente de las fuentes de datos: HTTP con caché en disco, concurrencia
// limitada y reintentos con espera (SPEC sección 7, "Reglas de uso").
//
// - Cada respuesta se guarda en .cache/<fuente>/ (ignorada por git): la segunda
//   ejecución no vuelve a pedir nada. Para refrescar, borrar esa carpeta.
// - Nunca más de MAX_CONCURRENCY solicitudes simultáneas en total, sin importar
//   cuántas tareas las pidan a la vez.
// - Se consulta solo desde los scripts de datos, nunca desde el sitio.

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { z } from 'zod';

export const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
export const API_BASE = 'https://pokeapi.co/api/v2';
export const TCGDEX_BASE = 'https://api.tcgdex.net/v2';

/** De dónde vienen los datos: dónde se guarda su caché y qué parte de la ruta no entra al nombre del archivo. */
export interface Source {
  readonly cacheDir: string;
  readonly pathPrefix: string;
}

export const POKEAPI: Source = { cacheDir: path.join(ROOT, '.cache', 'pokeapi'), pathPrefix: '/api/v2/' };
export const TCGDEX: Source = { cacheDir: path.join(ROOT, '.cache', 'tcgdex'), pathPrefix: '/v2/' };
export const WIKIDEX: Source = { cacheDir: path.join(ROOT, '.cache', 'wikidex'), pathPrefix: '/' };

const USER_AGENT = 'AnimeGuess-data-build (https://github.com/LucasButto/AmimeGuess)';
const MAX_CONCURRENCY = 5;
const MAX_ATTEMPTS = 6;
const BASE_DELAY_MS = 1000;
/** Una conexión que no responde se corta y se reintenta como cualquier fallo de red. */
const REQUEST_TIMEOUT_MS = 30_000;

/** El recurso no existe (404). No se reintenta; quien lo pide decide si es grave. */
export class NotFoundError extends Error {
  constructor(url: string) {
    super(`No existe ${url}`);
  }
}

class HttpError extends Error {
  readonly status: number;
  readonly retryAfterMs: number | null;

  constructor(status: number, url: string, retryAfterMs: number | null) {
    super(`HTTP ${status} en ${url}`);
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

// --- Concurrencia -----------------------------------------------------------

let activeRequests = 0;
const waiting: Array<() => void> = [];

/** Ejecuta `task` cuando hay un lugar libre entre las MAX_CONCURRENCY solicitudes simultáneas. */
async function withSlot<T>(task: () => Promise<T>): Promise<T> {
  if (activeRequests >= MAX_CONCURRENCY) {
    // El lugar lo cede quien termina, sin liberarlo: así nunca se pasa del tope.
    await new Promise<void>((resolve) => waiting.push(resolve));
  } else {
    activeRequests++;
  }
  try {
    return await task();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else activeRequests--;
  }
}

/** Como `Promise.all(items.map(fn))` pero con a lo sumo `limit` tareas en curso. Conserva el orden. */
export async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// --- HTTP -------------------------------------------------------------------

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function request(url: string): Promise<Buffer> {
  return withSlot(async () => {
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!response.ok) {
      const retryAfter = Number(response.headers.get('retry-after'));
      throw new HttpError(response.status, url, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : null);
    }
    return Buffer.from(await response.arrayBuffer());
  });
}

/** Descarga con reintentos: se reintenta ante fallos de red, 429 y 5xx; un 4xx es definitivo. */
async function download(url: string): Promise<Buffer> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await request(url);
    } catch (error) {
      lastError = error;
      const retryable = !(error instanceof HttpError) || error.status === 429 || error.status >= 500;
      if (!retryable || attempt === MAX_ATTEMPTS) break;
      const wait = error instanceof HttpError && error.retryAfterMs ? error.retryAfterMs : BASE_DELAY_MS * 2 ** (attempt - 1);
      await sleep(wait);
    }
  }
  if (lastError instanceof HttpError && lastError.status === 404) throw new NotFoundError(url);
  throw new Error(`No se pudo descargar ${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

// --- Caché ------------------------------------------------------------------

async function readCache(file: string): Promise<Buffer | null> {
  try {
    return await readFile(file);
  } catch {
    return null;
  }
}

/** Escribe en un archivo temporal y lo renombra: una corrida interrumpida no deja un archivo a medias. */
async function writeCache(file: string, data: Buffer): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, data);
  await rename(temporary, file);
}

function jsonCachePath(url: string, source: Source): string {
  const parsed = new URL(url);
  const relative = parsed.pathname.startsWith(source.pathPrefix)
    ? parsed.pathname.slice(source.pathPrefix.length)
    : parsed.pathname.slice(1);
  const resource = relative.replace(/\/$/, '');
  const query = parsed.search ? `__${parsed.search.slice(1).replace(/[^a-z0-9=&-]/gi, '_')}` : '';
  return path.join(source.cacheDir, 'json', `${resource}${query}.json`);
}

/** Datos del mismo origen se piden una sola vez: las tareas que piden la misma URL comparten la promesa. */
const inflight = new Map<string, Promise<Buffer>>();

async function cached(file: string, url: string): Promise<Buffer> {
  const pending = inflight.get(file);
  if (pending) return pending;
  const task = (async () => {
    const hit = await readCache(file);
    if (hit) return hit;
    const data = await download(url);
    await writeCache(file, data);
    return data;
  })();
  inflight.set(file, task);
  return task;
}

/** JSON de la API, validado con el esquema. Usa la caché si existe. */
export async function getJson<T>(url: string, schema: z.ZodType<T>, source: Source = POKEAPI): Promise<T> {
  const raw = await cached(jsonCachePath(url, source), url);
  const parsed = schema.safeParse(JSON.parse(raw.toString('utf8')));
  if (!parsed.success) {
    throw new Error(`Respuesta inesperada de ${url}: ${parsed.error.message}`);
  }
  return parsed.data;
}

/** Archivo binario (imagen). `cacheName` es la ruta dentro de .cache/<fuente>/files/. */
export async function getFile(url: string, cacheName: string, source: Source = POKEAPI): Promise<Buffer> {
  return cached(path.join(source.cacheDir, 'files', cacheName), url);
}
