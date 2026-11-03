// Clips del modo Jutsu (SPEC sección 7, "Videos"): de la escena que encontró trace.moe a un MP4 sin audio y un póster, con nombres
// opacos (la respuesta no se puede deducir de lo que pide la página).
//
// Para cada jutsu con datos en data-src/naruto/clips.json:
//   1. Baja el clip original de 640 px por su `videoId` (https://api.trace.moe/video/<videoId>?size=l&mute) a .cache/naruto/clips/.
//      Es una descarga, no una búsqueda: no gasta cuota. De a una, con User-Agent propio y reintentos con espera. Si no se puede,
//      usa la vista previa de 320 px que ya está en data-src/naruto/clips/.
//   2. ffmpeg: recorta la franja de abajo (los subtítulos chinos que trae el video), H.264, sin audio, +faststart. Si pasa del
//      presupuesto, vuelve a codificar con más compresión.
//   3. Un cuadro del medio del clip, como póster, en WebP de 256 y 512 px (los dos tamaños de siempre).
// Escribe el clip en public/video/naruto/<nombre>.mp4 y el póster en public/img/naruto/c/<nombre>-<tamaño>.webp.

import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';
import { ROOT } from './api.ts';
import { imageDimensions, imageFileName, renderPlainImage } from '../dragon-ball/images.ts';

const run = promisify(execFile);

export const CLIPS_FILE = path.join(ROOT, 'data-src', 'naruto', 'clips.json');
export const PREVIEW_DIR = path.join(ROOT, 'data-src', 'naruto', 'clips');
export const ORIGINAL_DIR = path.join(ROOT, '.cache', 'naruto', 'clips');
export const VIDEO_DIR = path.join(ROOT, 'public', 'video', 'naruto');
export const POSTER_DIR = path.join(ROOT, 'public', 'img', 'naruto', 'c');

/** Lo que pesa como mucho un clip ya procesado. */
export const CLIP_BUDGET = 350 * 1024;
/** Qué parte de la altura se recorta abajo (donde van los subtítulos del video). */
export const SUBTITLE_CROP = 0.14;
/** Ancho del clip procesado. */
const WIDTH = 640;
/** De la más suave a la más comprimida: el primero que entra en el presupuesto. */
const CRF_STEPS = [26, 28, 30, 32, 34, 36, 38];
const USER_AGENT = 'AnimeGuess-clips/1.0 (proyecto de fans sin fines de lucro; descarga de clips ya encontrados, sin búsquedas)';
const DOWNLOAD_ATTEMPTS = 3;
/** Pausa entre descargas, para no pasarse de los límites de trace.moe. */
const DOWNLOAD_PAUSE_MS = 1500;

/** La sal fija del nombre opaco: cambiarla cambia todos los nombres. */
const SALT = 'animeguess/jutsu-clip/v1';

/** El nombre opaco de un jutsu (16 caracteres): el mismo para el clip y para su póster. No se puede deducir del id sin la sal. */
export function opaqueName(id: string): string {
  return createHash('sha256').update(`${SALT}:${id}`).digest('hex').slice(0, 16);
}

const traceSchema = z.object({ videoId: z.string().min(1) }).passthrough();
const clipEntrySchema = z.object({ id: z.string().min(1), trace: traceSchema }).passthrough();
export const clipsFileSchema = z.object({ existing: z.array(clipEntrySchema), new: z.array(clipEntrySchema) }).passthrough();

/** videoId de trace.moe de cada jutsu con clip. */
export async function readClipSources(): Promise<Map<string, string>> {
  const parsed = clipsFileSchema.parse(JSON.parse(await readFile(CLIPS_FILE, 'utf8')));
  return new Map([...parsed.existing, ...parsed.new].map((entry) => [entry.id, entry.trace.videoId]));
}

export interface RenderedClip {
  readonly id: string;
  /** Ruta del póster dentro de /public/img, sin tamaño ni extensión. */
  readonly image: string;
  /** Ruta del clip dentro de /public/video, sin extensión. */
  readonly video: string;
  /** Medidas del póster más grande (las mismas proporciones que el clip). */
  readonly width: number;
  readonly height: number;
  readonly clipBytes: number;
  readonly posterBytes: number;
  /** Cómo se obtuvo el original: el de 640 px de trace.moe o la vista previa de 320 px. */
  readonly source: 'trace.moe' | 'vista previa';
  /** Compresión con que entró en el presupuesto (CRF de x264). */
  readonly crf: number;
}

/** Cuando trace.moe contesta que el clip ya no existe (4xx), no tiene sentido pedir los demás: se usan las vistas previas. */
let downloadsDisabled = false;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

/** El clip original en .cache (lo baja si no está). Devuelve el archivo y de dónde salió. */
export async function fetchOriginal(id: string, videoId: string): Promise<{ file: string; source: RenderedClip['source'] }> {
  const file = path.join(ORIGINAL_DIR, `${id}.mp4`);
  if (await exists(file)) return { file, source: 'trace.moe' };
  await mkdir(ORIGINAL_DIR, { recursive: true });
  const fallback = { file: path.join(PREVIEW_DIR, `${id}.mp4`), source: 'vista previa' as const };
  if (downloadsDisabled) return fallback;
  const url = `https://api.trace.moe/video/${encodeURIComponent(videoId)}?size=l&mute`;
  for (let attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (response.status >= 400 && response.status < 500) {
        // 403 o 410: el videoId venció (trace.moe guarda los clips un tiempo). Es permanente y vale para todos: no se insiste.
        downloadsDisabled = true;
        process.stderr.write(`  trace.moe contestó ${response.status} para ${id}: los clips originales ya no se pueden bajar; se usan las vistas previas de 320 px de data-src/naruto/clips/\n`);
        return fallback;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length < 1024) throw new Error('respuesta vacía');
      await writeFile(file, buffer);
      await sleep(DOWNLOAD_PAUSE_MS);
      return { file, source: 'trace.moe' };
    } catch (error) {
      if (attempt === DOWNLOAD_ATTEMPTS) {
        process.stderr.write(`  ${id}: no se pudo bajar el original (${error instanceof Error ? error.message : String(error)}); se usa la vista previa de 320 px\n`);
        return fallback;
      }
      await sleep(attempt * 4000);
    }
  }
  return fallback;
}

async function probe(file: string): Promise<{ width: number; height: number; duration: number }> {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,duration', '-of', 'json', file]);
  const stream = (JSON.parse(stdout) as { streams: Array<{ width: number; height: number; duration?: string }> }).streams[0];
  return { width: stream.width, height: stream.height, duration: Number(stream.duration ?? 0) };
}

/** Recorta la franja de subtítulos, escala a 640 px de ancho y codifica H.264 sin audio hasta que entra en el presupuesto. */
export async function encodeClip(input: string, output: string): Promise<{ bytes: number; crf: number }> {
  const { height, width } = await probe(input);
  // Alto que queda después del recorte, par (lo exige yuv420p).
  const kept = Math.floor((height * (1 - SUBTITLE_CROP)) / 2) * 2;
  const filter = `crop=${width}:${kept}:0:0,scale=${WIDTH}:-2:flags=lanczos`;
  await mkdir(path.dirname(output), { recursive: true });
  let last = { bytes: 0, crf: CRF_STEPS[0] };
  for (const crf of CRF_STEPS) {
    await run('ffmpeg', ['-y', '-v', 'error', '-i', input, '-vf', filter, '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-map_metadata', '-1', output]);
    last = { bytes: (await stat(output)).size, crf };
    if (last.bytes <= CLIP_BUDGET) return last;
  }
  throw new Error(`${path.basename(output)}: ni con CRF ${CRF_STEPS[CRF_STEPS.length - 1]} entra en ${CLIP_BUDGET} bytes (queda en ${last.bytes})`);
}

/** Un cuadro del medio del clip como PNG, para el póster. */
async function posterFrame(clip: string): Promise<Buffer> {
  const { duration } = await probe(clip);
  const at = Math.max(0, duration / 2).toFixed(2);
  const { stdout } = await run('ffmpeg', ['-v', 'error', '-ss', at, '-i', clip, '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'], { encoding: 'buffer', maxBuffer: 32 * 1024 * 1024 });
  return stdout as unknown as Buffer;
}

/** Procesa el clip de un jutsu y deja en public/ el MP4 y su póster. Si ya están hechos, los reutiliza (FORCE_CLIPS=1 los rehace). */
export async function renderClip(id: string, videoId: string): Promise<RenderedClip> {
  const name = opaqueName(id);
  const clipFile = path.join(VIDEO_DIR, `${name}.mp4`);
  const done = (await exists(clipFile)) && (await exists(path.join(POSTER_DIR, imageFileName(name, 512)))) && process.env.FORCE_CLIPS !== '1';
  let source: RenderedClip['source'] = 'trace.moe';
  let crf = 0;
  if (!done) {
    const original = await fetchOriginal(id, videoId);
    source = original.source;
    crf = (await encodeClip(original.file, clipFile)).crf;
    const poster = await posterFrame(clipFile);
    await renderPlainImage(name, poster, POSTER_DIR);
  }
  const size = await imageDimensions(path.join(POSTER_DIR, imageFileName(name, 512)));
  return {
    id,
    image: `naruto/c/${name}`,
    video: `naruto/${name}`,
    width: size.width,
    height: size.height,
    clipBytes: (await stat(clipFile)).size,
    posterBytes: (await stat(path.join(POSTER_DIR, imageFileName(name, 512)))).size + (await stat(path.join(POSTER_DIR, imageFileName(name, 256)))).size,
    source,
    crf,
  };
}
