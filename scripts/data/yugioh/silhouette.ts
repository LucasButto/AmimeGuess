// Silueta de Yu-Gi-Oh (sesión 13): el monstruo de cada carta recortado del fondo de su ilustración. El modo
// Silueta necesita un fondo transparente (SPEC 7) y las ilustraciones de YGOPRODeck son cuadros completos, así
// que acá se separa el monstruo con un modelo de segmentación y se guarda aparte, sin tocar la ilustración
// (Arte y Zoom siguen usándola entera).
//
// Modelo: BiRefNet_lite (licencia MIT), en su exportación ONNX de la comunidad de Hugging Face, ejecutado en
// local con onnxruntime-node (MIT). Gratuito y sin cuenta. Se baja una sola vez a .cache/models/ (ignorada
// por git, 224 MB) y solo hace falta cuando hay monstruos por procesar: el resultado queda en data/ y public/.

import path from 'node:path';
import sharp from 'sharp';
import { ROOT, getFile } from './api.ts';
import type { Source } from '../dragon-ball/api.ts';
import { SILHOUETTE, type Rendered } from './images.ts';
import { renderImage } from '../pokemon/images.ts';

export const MODEL_SOURCE: Source = { name: 'huggingface', cacheDir: path.join(ROOT, '.cache', 'models'), pathPrefix: '/', concurrency: 1 };
export const MODEL_URL = 'https://huggingface.co/onnx-community/BiRefNet_lite-ONNX/resolve/main/onnx/model.onnx';
const MODEL_CACHE_NAME = 'birefnet-lite.onnx';

// Normalización de ImageNet, la que usa BiRefNet.
const MEAN = [0.485, 0.456, 0.406] as const;
const STD = [0.229, 0.224, 0.225] as const;
/** Resolución de entrada de BiRefNet_lite. */
const INPUT_SIZE = 1024;

/**
 * Cuándo sirve un recorte para una silueta.
 *  - `coverage`: qué parte de la imagen ocupa el monstruo. Menos que `min`, el modelo no encontró nada (o solo un
 *    detalle); más que `max`, no separó el fondo (por ejemplo, un monstruo que llena la ilustración).
 *  - `connected`: qué parte de lo recortado es una sola pieza. Con menos, el modelo recortó también cosas del fondo
 *    (nubes, llamas, un patrón repetido) y la forma no se reconoce.
 */
export const THRESHOLDS = { coverage: { min: 0.08, max: 0.85 }, connected: 0.8 } as const;

/**
 * Limpieza del alfa que sale del modelo: por debajo de `floor` es el fondo (restos tenues, como las nubes lejanas de
 * una ilustración de nubes) y por encima de `ceiling` es del monstruo; en el medio queda el borde suave. Además se
 * borran las islas más chicas que `island` (fracción de la imagen): motas sueltas que no se reconocen.
 */
export const CLEANUP = { floor: 80, ceiling: 224, island: 0.004 } as const;

export interface CutoutMetrics {
  /** Fracción de la imagen que ocupa el monstruo (alfa mayor que la mitad), entre 0 y 1. */
  readonly coverage: number;
  /** Fracción de lo recortado que forma la pieza más grande (4 vecinos), entre 0 y 1. */
  readonly connected: number;
}

/** ¿Sirve este recorte para una silueta? */
export function isUsable(metrics: CutoutMetrics): boolean {
  return (
    metrics.coverage >= THRESHOLDS.coverage.min &&
    metrics.coverage <= THRESHOLDS.coverage.max &&
    metrics.connected >= THRESHOLDS.connected
  );
}

/**
 * Qué fracción de los píxeles marcados (1) forma la pieza conexa más grande, con vecinos arriba, abajo, izquierda y
 * derecha. Sin ningún píxel marcado da 0.
 */
export function largestShare(marked: Uint8Array, width: number, height: number): number {
  const seen = new Uint8Array(marked.length);
  const stack = new Int32Array(marked.length);
  let total = 0;
  for (const value of marked) if (value === 1) total++;
  let largest = 0;
  for (let start = 0; start < marked.length; start++) {
    if (marked[start] !== 1 || seen[start] === 1) continue;
    let size = 0;
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    while (top > 0) {
      const index = stack[--top];
      size++;
      const x = index % width;
      const y = (index - x) / width;
      const visit = (next: number) => {
        if (marked[next] === 1 && seen[next] === 0) {
          seen[next] = 1;
          stack[top++] = next;
        }
      };
      if (x > 0) visit(index - 1);
      if (x < width - 1) visit(index + 1);
      if (y > 0) visit(index - width);
      if (y < height - 1) visit(index + width);
    }
    largest = Math.max(largest, size);
  }
  return total === 0 ? 0 : largest / total;
}

/** Aplica `CLEANUP` al canal alfa (1 byte por píxel), en el lugar. */
export function cleanAlpha(alpha: Uint8Array, width: number, height: number): void {
  for (let index = 0; index < alpha.length; index++) {
    const value = alpha[index];
    alpha[index] = value < CLEANUP.floor ? 0 : value > CLEANUP.ceiling ? 255 : value;
  }
  const seen = new Uint8Array(alpha.length);
  const stack = new Int32Array(alpha.length);
  const members = new Int32Array(alpha.length);
  const smallest = CLEANUP.island * alpha.length;
  for (let start = 0; start < alpha.length; start++) {
    if (alpha[start] === 0 || seen[start] === 1) continue;
    let size = 0;
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    while (top > 0) {
      const index = stack[--top];
      members[size++] = index;
      const x = index % width;
      const y = (index - x) / width;
      const visit = (next: number) => {
        if (alpha[next] !== 0 && seen[next] === 0) {
          seen[next] = 1;
          stack[top++] = next;
        }
      };
      if (x > 0) visit(index - 1);
      if (x < width - 1) visit(index + 1);
      if (y > 0) visit(index - width);
      if (y < height - 1) visit(index + width);
    }
    if (size < smallest) for (let member = 0; member < size; member++) alpha[members[member]] = 0;
  }
}

/** El recorte con el alfa limpio (ver `CLEANUP`). */
export async function cleanCutout(png: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alpha = new Uint8Array(info.width * info.height);
  for (let index = 0; index < alpha.length; index++) alpha[index] = data[index * 4 + 3];
  cleanAlpha(alpha, info.width, info.height);
  for (let index = 0; index < alpha.length; index++) data[index * 4 + 3] = alpha[index];
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

/** Cobertura y conexión de un recorte (PNG con alfa), sin volver a correr el modelo. */
export async function measureCutout(png: Buffer): Promise<CutoutMetrics> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const marked = new Uint8Array(info.width * info.height);
  let inside = 0;
  for (let index = 0; index < marked.length; index++) {
    if (data[index * info.channels + 3] > 127) {
      marked[index] = 1;
      inside++;
    }
  }
  return { coverage: inside / marked.length, connected: largestShare(marked, info.width, info.height) };
}

/** Recorta el monstruo de una ilustración: un PNG RGBA del mismo tamaño, con el fondo transparente. */
export type Segmenter = (art: Buffer) => Promise<Buffer>;

/** Carga el modelo (y lo baja si falta) y devuelve la función que recorta una ilustración. */
export async function loadSegmenter(): Promise<Segmenter> {
  // Se carga recién acá: onnxruntime-node trae binarios nativos y solo hace falta si hay monstruos por procesar.
  const { InferenceSession, Tensor } = await import('onnxruntime-node');
  const model = await getFile(MODEL_URL, MODEL_CACHE_NAME, MODEL_SOURCE);
  const session = await InferenceSession.create(new Uint8Array(model.buffer, model.byteOffset, model.byteLength));
  const input = session.inputNames[0];
  const output = session.outputNames[0];

  return async (art) => {
    const { data, info } = await sharp(art).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const resized = await sharp(data, { raw: info })
      .resize(INPUT_SIZE, INPUT_SIZE, { fit: 'fill' })
      .raw()
      .toBuffer();

    const plane = INPUT_SIZE * INPUT_SIZE;
    const pixels = new Float32Array(3 * plane);
    for (let index = 0; index < plane; index++) {
      for (let channel = 0; channel < 3; channel++) {
        pixels[channel * plane + index] = (resized[index * 3 + channel] / 255 - MEAN[channel]) / STD[channel];
      }
    }

    const result = await session.run({ [input]: new Tensor('float32', pixels, [1, 3, INPUT_SIZE, INPUT_SIZE]) });
    const logits = result[output].data as Float32Array;
    const alpha = Buffer.alloc(plane);
    for (let index = 0; index < plane; index++) alpha[index] = Math.round(255 / (1 + Math.exp(-logits[index])));

    const mask = await sharp(alpha, { raw: { width: INPUT_SIZE, height: INPUT_SIZE, channels: 1 } })
      .resize(info.width, info.height, { fit: 'fill' })
      // Sin esto `sharp` devuelve la imagen en gris con 3 canales y la máscara deja de ser de 1 byte por píxel.
      .toColourspace('b-w')
      .raw()
      .toBuffer();
    if (mask.length !== info.width * info.height) throw new Error(`la máscara tiene ${mask.length} bytes y se esperaban ${info.width * info.height}`);

    // RGB + alfa intercalados a mano (RGBA): es lo que `sharp` espera de una imagen cruda de 4 canales.
    const rgba = Buffer.alloc(mask.length * 4);
    for (let index = 0; index < mask.length; index++) {
      rgba[index * 4] = data[index * 3];
      rgba[index * 4 + 1] = data[index * 3 + 1];
      rgba[index * 4 + 2] = data[index * 3 + 2];
      rgba[index * 4 + 3] = mask[index];
    }
    return sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  };
}

/** Guarda el recorte en WebP con transparencia, en los dos tamaños. */
export function renderSilhouette(id: string, png: Buffer, directory: string): Promise<Rendered[]> {
  return renderImage(id, png, directory, SILHOUETTE);
}
