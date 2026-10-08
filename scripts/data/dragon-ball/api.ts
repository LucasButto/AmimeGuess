// Cliente de las fuentes de datos de Dragon Ball: HTTP con caché en disco,
// concurrencia limitada por fuente y reintentos con espera (SPEC sección 7,
// "Reglas de uso").
//
// - Cada respuesta se guarda en .cache/dragon-ball/<fuente>/ (ignorada por git):
//   la segunda ejecución no vuelve a pedir nada. Para refrescar, borrar esa carpeta.
// - Dragon Ball API admite hasta 5 solicitudes simultáneas; la API MediaWiki de
//   Fandom, 2 (SPEC 7). El tope es por fuente y vale para todo el script.
// - Se consulta solo desde los scripts de datos, nunca desde el sitio.
// - Solo se descargan las imágenes de Dragon Ball API. Las de Fandom (static.wikia.nocookie.net)
//   responden con un desafío de Cloudflare a los clientes que no son un navegador: no se
//   intenta saltearlo. Esas imágenes se cargan a mano (docs/CONTENT_TODO.md).

import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { z } from 'zod';

export const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');

/** De dónde vienen los datos: dónde se guarda su caché, cuántas solicitudes admite a la vez y qué parte de la ruta no entra al nombre del archivo. */
export interface Source {
  readonly name: string;
  readonly cacheDir: string;
  readonly pathPrefix: string;
  readonly concurrency: number;
}

export const DRAGONBALL_API_BASE = 'https://dragonball-api.com/api';
export const WIKI_ES_API = 'https://dragonball.fandom.com/es/api.php';

export const DRAGONBALL_API: Source = {
  name: 'dragonball-api',
  cacheDir: path.join(ROOT, '.cache', 'dragon-ball', 'dragonball-api'),
  pathPrefix: '/api/',
  concurrency: 5,
};
export const WIKI_ES: Source = {
  name: 'wiki-es',
  cacheDir: path.join(ROOT, '.cache', 'dragon-ball', 'wiki-es'),
  pathPrefix: '/es/',
  concurrency: 2,
};

const USER_AGENT = 'AnimeGuess-data-build (https://github.com/LucasButto/AmimeGuess)';
const MAX_ATTEMPTS = 6;
const BASE_DELAY_MS = 1000;

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

interface Slots {
  active: number;
  waiting: Array<() => void>;
}

const slotsBySource = new Map<string, Slots>();

/** Ejecuta `task` cuando hay un lugar libre entre las solicitudes simultáneas que admite la fuente. */
async function withSlot<T>(source: Source, task: () => Promise<T>): Promise<T> {
  let slots = slotsBySource.get(source.name);
  if (slots === undefined) {
    slots = { active: 0, waiting: [] };
    slotsBySource.set(source.name, slots);
  }
  if (slots.active >= source.concurrency) {
    // El lugar lo cede quien termina, sin liberarlo: así nunca se pasa del tope.
    await new Promise<void>((resolve) => slots.waiting.push(resolve));
  } else {
    slots.active++;
  }
  try {
    return await task();
  } finally {
    const next = slots.waiting.shift();
    if (next) next();
    else slots.active--;
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

async function request(url: string, source: Source): Promise<Buffer> {
  return withSlot(source, async () => {
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!response.ok) {
      const retryAfter = Number(response.headers.get('retry-after'));
      throw new HttpError(response.status, url, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : null);
    }
    return Buffer.from(await response.arrayBuffer());
  });
}

/** Descarga con reintentos: se reintenta ante fallos de red, 429 y 5xx; un 4xx es definitivo. */
async function download(url: string, source: Source): Promise<Buffer> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await request(url, source);
    } catch (error) {
      lastError = error;
      const retryable = !(error instanceof HttpError) || error.status === 429 || error.status >= 500;
      if (!retryable || attempt === MAX_ATTEMPTS) break;
      const wait = error instanceof HttpError && error.retryAfterMs ? error.retryAfterMs : BASE_DELAY_MS * 2 ** (attempt - 1);
      await sleep(wait);
    }
  }
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
  const resource = relative.replace(/\/$/, '').replace(/[^a-z0-9._/-]/gi, '_');
  // Una consulta larga se acorta, pero con un hash de la consulta completa: dos páginas
  // de una misma categoría no pueden terminar en el mismo archivo.
  const full = parsed.search ? decodeURIComponent(parsed.search.slice(1)) : '';
  const readable = full.replace(/[^a-z0-9=&.-]/gi, '_');
  const query = full === '' ? '' : readable.length <= 80 ? `__${readable}` : `__${readable.slice(0, 60)}_${createHash('sha1').update(full).digest('hex').slice(0, 12)}`;
  return path.join(source.cacheDir, 'json', `${resource}${query}.json`);
}

/** Datos del mismo origen se piden una sola vez: las tareas que piden la misma URL comparten la promesa. */
const inflight = new Map<string, Promise<Buffer>>();

async function cached(file: string, url: string, source: Source): Promise<Buffer> {
  const pending = inflight.get(file);
  if (pending) return pending;
  const task = (async () => {
    const hit = await readCache(file);
    if (hit) return hit;
    const data = await download(url, source);
    await writeCache(file, data);
    return data;
  })();
  inflight.set(file, task);
  return task;
}

/** JSON de la fuente, validado con el esquema. Usa la caché si existe. */
export async function getJson<T>(url: string, schema: z.ZodType<T>, source: Source): Promise<T> {
  const raw = await cached(jsonCachePath(url, source), url, source);
  const parsed = schema.safeParse(JSON.parse(raw.toString('utf8')));
  if (!parsed.success) {
    throw new Error(`Respuesta inesperada de ${url}: ${parsed.error.message}`);
  }
  return parsed.data;
}

/** Archivo binario (imagen). `cacheName` es la ruta dentro de .cache/dragon-ball/<fuente>/files/. */
export async function getFile(url: string, cacheName: string, source: Source): Promise<Buffer> {
  return cached(path.join(source.cacheDir, 'files', cacheName), url, source);
}
