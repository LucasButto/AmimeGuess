// Clips del modo Técnica (SPEC sección 7, "Videos"): de los clips ya aprobados a un MP4 sin audio y un póster, con nombres opacos
// (la respuesta no se puede deducir de lo que pide la página). Mismo modelo que scripts/data/naruto/clips.ts, pero SIN descargar
// nada: los originales de 640 px ya están en data/dragon-ball/source/technique-clips/clips/<id>.mp4 (los de trace.moe vencen, así que
// se bajaron una vez y se guardaron en el repo).
//
// Para cada técnica con clip en data/dragon-ball/source/technique-clips/approved.json:
//   1. Solo los clips que vienen de trace.moe: recorta la franja de abajo (los subtítulos chinos que trae el video). Los de los videos
//      aportados no llevan subtítulos: no se recortan.
//   2. Marcas encima de la imagen: la marca del canal del video 3 de tu amigo y el logo de TV de dos clips de Super se borran con
//      `delogo` y un desenfoque de esa zona (ver `overlaysOf`). Es una interpolación de los píxeles de alrededor: en el área tapada se nota un leve borroneo.
//   3. ffmpeg: H.264, sin audio, +faststart, 640 px de ancho. Si no hay recorte ni borrado y el clip aprobado ya entra en el presupuesto,
//      se copia el flujo tal cual (sin volver a comprimir: no pierde calidad); si no, se codifica con la compresión más suave que entre.
//   4. Un cuadro del medio del clip, como póster, en WebP de 256 y 512 px (los dos tamaños de siempre).
// Escribe el clip en public/video/dragon-ball/<nombre>.mp4 y el póster en public/img/dragon-ball/c/<nombre>-<tamaño>.webp.

import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';
import { ROOT } from './api.ts';
import { imageDimensions, imageFileName, renderPlainImage } from './images.ts';

const run = promisify(execFile);

export const SOURCE_DIR = path.join(ROOT, 'data', 'dragon-ball', 'source', 'technique-clips');
export const APPROVED_FILE = path.join(SOURCE_DIR, 'approved.json');
export const VIDEO_DIR = path.join(ROOT, 'public', 'video', 'dragon-ball');
export const POSTER_DIR = path.join(ROOT, 'public', 'img', 'dragon-ball', 'c');

/** Lo que pesa como mucho un clip ya procesado. */
export const CLIP_BUDGET = 350 * 1024;
/** Qué parte de la altura se recorta abajo (donde van los subtítulos de los clips de trace.moe). */
export const SUBTITLE_CROP = 0.14;
/** Ancho del clip procesado. */
const WIDTH = 640;
/** Cuánto se desenfoca la zona de donde se borró una marca (suaviza las rayas que deja `delogo`). */
const PATCH_BLUR = 6;
/** De la más suave a la más comprimida: el primero que entra en el presupuesto. */
const CRF_STEPS = [26, 28, 30, 32, 34, 36, 38];

/** La sal fija del nombre opaco: cambiarla cambia todos los nombres. Propia de Dragon Ball. */
const SALT = 'animeguess/dragon-ball-technique-clip/v1';

/** El nombre opaco de una técnica (16 caracteres): el mismo para el clip y para su póster. No se puede deducir del id sin la sal. */
export function opaqueName(id: string): string {
  return createHash('sha256').update(`${SALT}:${id}`).digest('hex').slice(0, 16);
}

/** De dónde salió el clip: una escena que encontró trace.moe o un video aportado (sin nombrar el canal: los créditos de los canales van aparte). */
export type ClipOrigin = 'trace.moe' | 'video aportado';
const clipEntrySchema = z.object({ id: z.string().min(1), clip: z.string().min(1), origin: z.string().min(1), sourceNote: z.string().optional() }).passthrough();
const approvedFileSchema = z.object({ approved: z.array(clipEntrySchema) }).passthrough();

/** Un rectángulo en píxeles del clip (que mide 640 de ancho), con la esquina de arriba a la izquierda en `x`, `y`. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * La marca de agua que traen los clips del video 3 aportado (los de los videos 1 y 2 no la tienen). Es fija dentro de cada clip,
 * pero según el recorte del clip queda arriba (pegada al borde de arriba) o más abajo (unos 25 a 35 px del borde); siempre contra la
 * derecha, a veces cortada por el borde. Las posiciones se midieron a mano (y con una búsqueda de la marca en cada clip).
 */
const WATERMARK_TOP: Rect = { x: 454, y: 2, w: 184, h: 48 };
const WATERMARK_LOW: Rect = { x: 440, y: 20, w: 198, h: 56 };
/** Los clips de ese video donde la marca queda abajo (en los demás queda arriba). */
const WATERMARK_LOW_CLIPS: ReadonlySet<string> = new Set([
  'autodestruccion-2',
  'dodompa-db',
  'dodompa-db-2',
  'escupitajo-petrificante',
  'escupitajo-petrificante-2',
  'regeneracion-2',
  'resplandor-del-diablo',
  'viaje-en-pilar-db',
]);
/**
 * Una línea de texto chica ("DRAGONBALL…") que acompaña a la marca pegada al borde de arriba cuando esta queda abajo. Borrarla con
 * `delogo` copia sus restos hacia adentro (rayas), así que en esos clips se recorta la franja de arriba entera.
 */
const WATERMARK_STRIP_HEIGHT = 12;
/** Los clips de trace.moe que traen el logo de la TV (la franja de texto chica de arriba a la derecha, fija en todo el clip). */
const TV_LOGO_TOP_RIGHT: Rect = { x: 550, y: 14, w: 88, h: 26 };
const TV_LOGO_TOP_RIGHT_CLIPS: ReadonlySet<string> = new Set(['aguja-venenosa-super-2', 'makankosappo-super-super']);
/** El logo de la TV, apagado, arriba a la izquierda de algunos clips del video 3 (los de Dragon Ball Super en emisión). */
const TV_LOGO_TOP_LEFT: Rect = { x: 8, y: 3, w: 64, h: 26 };
const TV_LOGO_TOP_LEFT_CLIPS: ReadonlySet<string> = new Set(['espada-de-ki-super-2', 'espada-de-ki-super-3', 'materializacion']);

/**
 * Elementos que trae la propia emisión del anime y no son parte de la técnica: el cronómetro del Torneo del Poder, arriba a la izquierda
 * (fijo en todo el clip), y un subtítulo chino arriba al centro en `kamehameha`. Se borran igual que las marcas.
 */
const SHOW_HUD: Readonly<Record<string, readonly Rect[]>> = {
  'esfera-de-destruccion-super': [{ x: 44, y: 24, w: 74, h: 30 }],
  kamehameha: [
    { x: 44, y: 24, w: 74, h: 30 },
    { x: 232, y: 4, w: 172, h: 26 },
  ],
};

/** Lo que hay que borrar encima de la imagen de este clip: una o más zonas (vacío si está limpio). */
export function overlaysOf(id: string, origin: ClipSource['origin'], sourceNote: string | undefined): Rect[] {
  const rects: Rect[] = [];
  if (origin === 'video aportado' && sourceNote?.startsWith('video 3 de tu amigo')) {
    rects.push(WATERMARK_LOW_CLIPS.has(id) ? WATERMARK_LOW : WATERMARK_TOP);
  }
  if (origin === 'trace.moe' && TV_LOGO_TOP_RIGHT_CLIPS.has(id)) rects.push(TV_LOGO_TOP_RIGHT);
  if (TV_LOGO_TOP_LEFT_CLIPS.has(id)) rects.push(TV_LOGO_TOP_LEFT);
  rects.push(...(SHOW_HUD[id] ?? []));
  return rects;
}

/**
 * Franjas del borde que sobran en algunos clips (restos de las barras del video de origen), en píxeles. Se recortan y el clip se vuelve a
 * escalar a 640 de ancho. Detectadas midiendo el brillo de las filas y columnas de los bordes de los 130 clips. En los costados hay una
 * columna de 1 px (a veces 2) más oscura o clara; se recortan 2 px de cada lado.
 */
const SIDE_PX = 2;
const EDGE_BARS: Readonly<Record<string, { top?: number; bottom?: number; sides?: number }>> = {
  'escupitajo-petrificante': { top: 4, bottom: 4 },
  'supernova-super': { bottom: 2 },
  'ataque-de-ira-de-gohan': { sides: SIDE_PX },
  'hakai-super-2': { sides: SIDE_PX },
  'jaula-del-tiempo-super-2': { sides: SIDE_PX },
  'kienzan-super': { sides: SIDE_PX },
  masenko: { sides: SIDE_PX },
  'salto-temporal-super': { sides: SIDE_PX },
  'salto-temporal-super-2': { sides: SIDE_PX },
  supernova: { sides: SIDE_PX },
  'supernova-3': { sides: SIDE_PX },
};

/** Cuánto se recorta de cada borde de este clip (ver `EDGE_BARS` y `WATERMARK_STRIP_HEIGHT`). */
export function edgeOf(id: string, origin: ClipSource['origin'], sourceNote: string | undefined): { top: number; bottom: number; left: number; right: number } {
  const stripped = origin === 'video aportado' && sourceNote?.startsWith('video 3 de tu amigo') && WATERMARK_LOW_CLIPS.has(id) ? WATERMARK_STRIP_HEIGHT : 0;
  const sides = EDGE_BARS[id]?.sides ?? 0;
  return { top: Math.max(EDGE_BARS[id]?.top ?? 0, stripped), bottom: EDGE_BARS[id]?.bottom ?? 0, left: sides, right: sides };
}

export interface ClipSource {
  readonly id: string;
  /** Archivo aprobado (ya en 640 px, sin audio). */
  readonly file: string;
  readonly origin: ClipOrigin;
  /** Marcas encima de la imagen que hay que borrar (ver `overlaysOf`). */
  readonly overlays: readonly Rect[];
  /** Franjas de borde para recortar (ver `EDGE_BARS`). */
  readonly edge: { readonly top: number; readonly bottom: number; readonly left: number; readonly right: number };
}

/** Los clips aprobados, por id de técnica. */
export async function readClipSources(): Promise<Map<string, ClipSource>> {
  const parsed = approvedFileSchema.parse(JSON.parse(await readFile(APPROVED_FILE, 'utf8')));
  return new Map(parsed.approved.map((entry) => {
    const origin: ClipOrigin = entry.origin === 'trace.moe' ? 'trace.moe' : 'video aportado';
    return [entry.id, { id: entry.id, file: path.join(SOURCE_DIR, entry.clip), origin, overlays: overlaysOf(entry.id, origin, entry.sourceNote), edge: edgeOf(entry.id, origin, entry.sourceNote) }];
  }));
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
  readonly source: ClipSource['origin'];
  /** Cómo quedó: compresión con que entró en el presupuesto (CRF de x264) o `copia` si se usó el clip aprobado tal cual. */
  readonly crf: number | 'copia';
  /** Si se le recortó la franja de subtítulos. */
  readonly cropped: boolean;
  /** Si se le borró una marca (la marca del canal o un logo de TV). */
  readonly cleaned: boolean;
  readonly seconds: number;
}

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function probe(file: string): Promise<{ width: number; height: number; duration: number }> {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,duration', '-of', 'json', file]);
  const stream = (JSON.parse(stdout) as { streams: Array<{ width: number; height: number; duration?: string }> }).streams[0];
  return { width: stream.width, height: stream.height, duration: Number(stream.duration ?? 0) };
}

/**
 * Deja el clip en `output`: con recorte de subtítulos (solo trace.moe) o con una marca para borrar siempre se codifica; si no, y si el
 * aprobado ya entra en el presupuesto, se copia el flujo (con +faststart); si no, se codifica con la compresión más suave que entre.
 */
export async function encodeClip(input: string, output: string, options: { crop: boolean; overlays: readonly Rect[]; edge: { top: number; bottom: number; left: number; right: number } }): Promise<{ bytes: number; crf: number | 'copia' }> {
  const { crop, overlays, edge } = options;
  const { height, width } = await probe(input);
  await mkdir(path.dirname(output), { recursive: true });
  const trimmed = edge.top + edge.bottom + edge.left + edge.right > 0;
  if (!crop && !trimmed && overlays.length === 0 && (await stat(input)).size <= CLIP_BUDGET && width === WIDTH) {
    await run('ffmpeg', ['-y', '-v', 'error', '-i', input, '-an', '-c:v', 'copy', '-movflags', '+faststart', '-map_metadata', '-1', output]);
    return { bytes: (await stat(output)).size, crf: 'copia' };
  }
  // Primero se borran las marcas (sus coordenadas son las del clip entero) y después se recorta: la franja de abajo con los subtítulos
  // (trace.moe) y los restos de barras de los bordes.
  const bottom = (crop ? Math.round(height * SUBTITLE_CROP) : 0) + edge.bottom;
  // Alto que queda después del recorte, par (lo exige yuv420p).
  const kept = Math.floor((height - edge.top - bottom) / 2) * 2;
  const graph: string[] = [];
  let label = '0:v';
  overlays.forEach((original, index) => {
    // Coordenadas y medidas pares: con yuv420p (color a mitad de resolución) el parche en una posición impar deja rayas verdes.
    const rect = { x: original.x - (original.x % 2), y: original.y - (original.y % 2), w: original.w - (original.w % 2), h: original.h - (original.h % 2) };
    // `delogo` borra el texto interpolando los píxeles de alrededor (deja rayas verticales); un desenfoque de esa zona las suaviza. El
    // desenfoque va en yuv444p: `gblur` sobre yuv420p deja rayas verdes.
    graph.push(
      `[${label}]delogo=x=${rect.x}:y=${rect.y}:w=${rect.w}:h=${rect.h},split[a${index}][b${index}]`,
      `[b${index}]crop=${rect.w}:${rect.h}:${rect.x}:${rect.y},format=yuv444p,gblur=sigma=${PATCH_BLUR},format=yuv420p[c${index}]`,
      `[a${index}][c${index}]overlay=${rect.x}:${rect.y}[s${index}]`,
    );
    label = `s${index}`;
  });
  const trim = crop || trimmed ? [`crop=${width - edge.left - edge.right}:${kept}:${edge.left}:${edge.top}`] : [];
  graph.push(`[${label}]${[...trim, `scale=${WIDTH}:-2:flags=lanczos`].join(',')}[out]`);
  const filter = graph.join(';');
  let last = { bytes: 0, crf: CRF_STEPS[0] };
  for (const crf of CRF_STEPS) {
    await run('ffmpeg', ['-y', '-v', 'error', '-i', input, '-filter_complex', filter, '-map', '[out]', '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-map_metadata', '-1', output]);
    last = { bytes: (await stat(output)).size, crf };
    if (last.bytes <= CLIP_BUDGET) return last;
  }
  throw new Error(`${path.basename(input)}: ni con CRF ${CRF_STEPS[CRF_STEPS.length - 1]} entra en ${CLIP_BUDGET} bytes (queda en ${last.bytes})`);
}

/** Un cuadro del medio del clip como PNG, para el póster. */
async function posterFrame(clip: string): Promise<Buffer> {
  const { duration } = await probe(clip);
  const at = Math.max(0, duration / 2).toFixed(2);
  const { stdout } = await run('ffmpeg', ['-v', 'error', '-ss', at, '-i', clip, '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'], { encoding: 'buffer', maxBuffer: 32 * 1024 * 1024 });
  return stdout as unknown as Buffer;
}

/** Procesa el clip de una técnica y deja en public/ el MP4 y su póster. Si ya están hechos, los reutiliza (FORCE_CLIPS=1 los rehace). */
export async function renderClip(source: ClipSource): Promise<RenderedClip> {
  const name = opaqueName(source.id);
  const clipFile = path.join(VIDEO_DIR, `${name}.mp4`);
  const cropped = source.origin === 'trace.moe';
  const done = (await exists(clipFile)) && (await exists(path.join(POSTER_DIR, imageFileName(name, 512)))) && process.env.FORCE_CLIPS !== '1';
  let crf: RenderedClip['crf'] = 0;
  if (!done) {
    if (!(await exists(source.file))) throw new Error(`${source.id}: falta el clip aprobado ${path.relative(ROOT, source.file)}`);
    crf = (await encodeClip(source.file, clipFile, { crop: cropped, overlays: source.overlays, edge: source.edge })).crf;
    const poster = await posterFrame(clipFile);
    await renderPlainImage(name, poster, POSTER_DIR);
  }
  const size = await imageDimensions(path.join(POSTER_DIR, imageFileName(name, 512)));
  return {
    id: source.id,
    image: `dragon-ball/c/${name}`,
    video: `dragon-ball/${name}`,
    width: size.width,
    height: size.height,
    clipBytes: (await stat(clipFile)).size,
    posterBytes: (await stat(path.join(POSTER_DIR, imageFileName(name, 512)))).size + (await stat(path.join(POSTER_DIR, imageFileName(name, 256)))).size,
    source: source.origin,
    crf,
    cropped,
    cleaned: source.overlays.length > 0,
    seconds: (await probe(clipFile)).duration,
  };
}
