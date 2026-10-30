import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { directionCrop, opaqueBounds, PMD_TICK_MS, type Direction, type Animation, type Box } from './pmd-core.ts';

export const sha256 = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');

export function sameVisiblePixels(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] !== b[i + 3]) return false;
    if (a[i + 3] && (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2])) return false;
  }
  return true;
}

export interface FrameSelection { indices: readonly number[]; durationMs: number }

function unionBounds(boxes: readonly Box[]): Box {
  const left = Math.min(...boxes.map(box => box.x)), top = Math.min(...boxes.map(box => box.y));
  return { x: left, y: top, width: Math.max(...boxes.map(box => box.x + box.width)) - left,
    height: Math.max(...boxes.map(box => box.y + box.height)) - top };
}

/** Crops a direction, optionally selecting native frames without scaling or changing pixels. */
export async function processDirection(source: Buffer, animation: Required<Omit<Animation, 'copyOf'>>, direction: Direction, selection?: FrameSelection, durationFactor = 1) {
  if (!Number.isFinite(durationFactor) || durationFactor <= 0) throw new Error('Factor de duracion PMD invalido');
  const meta = await sharp(source).metadata();
  if (meta.format !== 'png' || !meta.width || !meta.height) throw new Error('Hoja PMD no es PNG');
  const crop = directionCrop(meta.width, meta.height, animation, direction);
  const row = await sharp(source).extract(crop).ensureAlpha().raw().toBuffer();
  const indices = selection?.indices ?? animation.ticks.map((_, index) => index);
  if (!indices.length || indices.some(index => !Number.isInteger(index) || index < 0 || index >= animation.ticks.length)
    || (selection && (!Number.isInteger(selection.durationMs / PMD_TICK_MS) || selection.durationMs <= 0))) throw new Error('Seleccion de cuadros PMD invalida');
  const width = indices.length * animation.width;
  const raw = selection ? Buffer.alloc(width * crop.height * 4) : row;
  if (selection) for (let y = 0; y < crop.height; y++) indices.forEach((sourceIndex, index) => {
    const start = (y * crop.width + sourceIndex * animation.width) * 4;
    row.copy(raw, (y * width + index * animation.width) * 4, start, start + animation.width * 4);
  });
  const image = await sharp(raw, { raw: { width, height: crop.height, channels: 4 } })
    .webp({ lossless: true, effort: 6 }).toBuffer();
  const decoded = await sharp(image).ensureAlpha().raw().toBuffer();
  if (!sameVisiblePixels(raw, decoded)) throw new Error('La codificación modificó píxeles visibles');
  // SpriteBot/SpriteUtils.py rel_center = (tileWidth // 2, tileHeight // 2 + 4).
  const anchor = { x: Math.floor(animation.width / 2), y: Math.floor(animation.height / 2) + 4 };
  const frames = indices.map((sourceIndex, index) => ({
    index, ...(selection ? { sourceIndex } : {}), x: index * animation.width, y: 0,
    ticks: selection ? selection.durationMs / PMD_TICK_MS : animation.ticks[sourceIndex],
    durationMs: (selection?.durationMs ?? animation.ticks[sourceIndex] * PMD_TICK_MS) * durationFactor,
    offset: { x: -anchor.x, y: -anchor.y },
    bbox: opaqueBounds(raw, width, { x: index * animation.width, y: 0, width: animation.width, height: animation.height }),
  }));
  if (!frames.some((frame) => frame.bbox)) throw new Error('Fila PMD completamente vacía');
  const boxes = frames.flatMap((frame) => frame.bbox ? [frame.bbox] : []);
  const bbox = unionBounds(boxes);
  // Retain only the old aspect reference for sizing; drawing/entry clearance uses bbox above.
  const referenceBbox = selection ? unionBounds(animation.ticks.flatMap((_, index) => {
    const box = opaqueBounds(row, crop.width, { x: index * animation.width, y: 0, width: animation.width, height: animation.height });
    return box ? [box] : [];
  })) : undefined;
  return {
    image,
    metadata: {
      width, height: crop.height, frameWidth: animation.width, frameHeight: animation.height,
      sourceWidth: meta.width, sourceHeight: meta.height, sourceRow: crop.sourceRow, sourceRows: crop.sourceRows,
      anchor, bbox,
      ...(referenceBbox ? { referenceBbox } : {}),
      ...(durationFactor !== 1 ? { durationFactor } : {}),
      totalDurationMs: frames.reduce((total, frame) => total + frame.durationMs, 0), frames,
    },
  };
}

/** Native SpriteCollab shadow mask, decoded with SpriteBot's RGB/ShadowSize convention. */
export async function processShadow(source: Buffer, animation: Required<Omit<Animation, 'copyOf'>>, direction: Direction, shadowSize: number, selection?: FrameSelection, durationFactor = 1) {
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const mask = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 255 && (data[i + 1] === 255 || (data[i] === 255 && shadowSize > 0) || (data[i + 2] === 255 && shadowSize > 1))) mask[i + 3] = 160;
  }
  const image = await sharp(mask, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  return processDirection(image, animation, direction, selection, durationFactor);
}

export async function processPortrait(source: Buffer): Promise<Buffer> {
  const meta = await sharp(source).metadata();
  if (meta.format !== 'png' || meta.width !== 40 || meta.height !== 40) throw new Error('Retrato PMD debe ser PNG de 40×40');
  const originalPixels = await sharp(source).ensureAlpha().raw().toBuffer();
  if (!opaqueBounds(originalPixels, 40, { x: 0, y: 0, width: 40, height: 40 })) throw new Error('Retrato vacío');
  let result = source;
  const candidates = [
    await sharp(source).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer(),
    await sharp(source).png({ palette: true, colours: 256, dither: 0, effort: 10, compressionLevel: 9 }).toBuffer(),
  ];
  for (const candidate of candidates) {
    // Palette encoders can quantize: accept ONLY exact visible RGBA matches.
    if (candidate.length < result.length && sameVisiblePixels(originalPixels, await sharp(candidate).ensureAlpha().raw().toBuffer())) result = candidate;
  }
  return result;
}
