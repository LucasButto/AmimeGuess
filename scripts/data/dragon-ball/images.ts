// Preparación de imágenes para el motor image-reveal (SPEC sección 7, "Imágenes").
//
// El motor trata como cuadrada la imagen de una entidad (src/modes/image-reveal/logic.ts,
// ENTITY_IMAGE_SIZE) y abre el zoom en la franja central. Los personajes de Dragon Ball API
// son figuras altas con fondo transparente, así que se centran en un lienzo cuadrado
// transparente: la sombra de Silueta se ve entera y el zoom cae sobre la figura.
// Las imágenes con fondo (cargadas a mano) se recortan al cuadrado, sin lienzo.
//
// La conversión a WebP en dos tamaños es la misma de Pokémon (scripts/data/pokemon/images.ts).

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { renderImage, type RenderOptions, type Rendered, ARTWORK } from '../pokemon/images.ts';

export { imageDimensions, imageFileName, SIZES } from '../pokemon/images.ts';
export type { Rendered } from '../pokemon/images.ts';

/** Lado del lienzo cuadrado de las imágenes de entidad, igual al tamaño grande. */
const CANVAS = 512;
/** Aire alrededor de la figura, en píxeles del lienzo. */
const MARGIN = 16;
/** Un píxel con alfa menor que esto cuenta como transparente. */
const ALPHA_EMPTY = 13;
/** Un píxel del borde con alfa mayor que esto cuenta como fondo opaco. */
const ALPHA_SOLID = 200;

/** Arte de personajes y formas: igual que el oficial de Pokémon, pero algo más abajo si hace falta (figuras con mucho detalle). */
export const ENTITY_ART: RenderOptions = {
  qualities: [...ARTWORK.qualities, 35, 30],
  budget: ARTWORK.budget,
};

/** Capturas de técnicas: se comprimen como arte y se ven borrosas, así que se puede bajar más la calidad. */
export const TECHNIQUE_ART: RenderOptions = {
  qualities: [85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30],
  budget: ARTWORK.budget,
};

export interface Analysis {
  readonly width: number;
  readonly height: number;
  /** Porcentaje de la imagen con alfa casi nulo. */
  readonly transparentPct: number;
  /** Porcentaje de píxeles del borde que son opacos: un fondo de color da cerca de 100. */
  readonly borderSolidPct: number;
  /** Caja que contiene todo lo que no es transparente. */
  readonly bounds: { left: number; top: number; width: number; height: number } | null;
}

/** Mide cuánto de la imagen es transparente y dónde está la figura. */
export async function analyze(source: Buffer): Promise<Analysis> {
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  let empty = 0;
  let borderSolid = 0;
  let borderTotal = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha < ALPHA_EMPTY) {
        empty++;
      } else {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        borderTotal++;
        if (alpha > ALPHA_SOLID) borderSolid++;
      }
    }
  }
  return {
    width,
    height,
    transparentPct: round1((100 * empty) / (width * height)),
    borderSolidPct: round1((100 * borderSolid) / borderTotal),
    bounds: maxX < 0 ? null : { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * ¿Es arte recortado, de fondo transparente? Sirve para Silueta. Hace falta que
 * una parte buena de la imagen sea transparente y que el borde no sea un fondo opaco.
 */
export function isTransparentArt(analysis: Analysis): boolean {
  return analysis.transparentPct >= 15 && analysis.borderSolidPct <= 5 && analysis.bounds !== null;
}

/** Imagen cuadrada de 512 px lista para convertir: la figura centrada en un lienzo transparente, o el recorte cuadrado si tiene fondo. */
export async function toSquare(source: Buffer, analysis: Analysis): Promise<Buffer> {
  if (!isTransparentArt(analysis) || analysis.bounds === null) {
    return sharp(source).flatten({ background: '#ffffff' }).resize(CANVAS, CANVAS, { fit: 'cover', position: sharp.strategy.attention }).png().toBuffer();
  }
  const inner = CANVAS - 2 * MARGIN;
  const figure = await sharp(source)
    .ensureAlpha()
    .extract(analysis.bounds)
    .resize(inner, inner, { fit: 'inside' })
    .png()
    .toBuffer({ resolveWithObject: true });
  return sharp({ create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      {
        input: figure.data,
        left: Math.round((CANVAS - figure.info.width) / 2),
        top: Math.round((CANVAS - figure.info.height) / 2),
      },
    ])
    .png()
    .toBuffer();
}

/** Convierte una imagen de entidad al lienzo cuadrado y la guarda en los dos tamaños. */
export async function renderEntityImage(
  id: string,
  source: Buffer,
  directory: string,
): Promise<{ rendered: Rendered[]; analysis: Analysis; transparent: boolean }> {
  const analysis = await analyze(source);
  const square = await toSquare(source, analysis);
  const rendered = await renderImage(id, square, directory, ENTITY_ART);
  return { rendered, analysis, transparent: isTransparentArt(analysis) };
}

/** Convierte una imagen que no es de entidad (captura de técnica) conservando su proporción. */
export async function renderPlainImage(id: string, source: Buffer, directory: string, options: RenderOptions = TECHNIQUE_ART): Promise<Rendered[]> {
  return renderImage(id, source, directory, options);
}

const MANUAL_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];

/**
 * La imagen cargada a mano para `id` en `directory`, si existe. Se acepta cualquiera de
 * las extensiones de MANUAL_EXTENSIONS; si hay más de una, falla (no se adivina cuál vale).
 */
export async function readManualImage(directory: string, id: string): Promise<{ file: string; buffer: Buffer } | null> {
  const found: string[] = [];
  const buffers: Buffer[] = [];
  for (const extension of MANUAL_EXTENSIONS) {
    const file = path.join(directory, `${id}.${extension}`);
    try {
      buffers.push(await readFile(file));
      found.push(file);
    } catch {
      // No está con esa extensión.
    }
  }
  if (found.length > 1) throw new Error(`Hay más de una imagen manual para ${id}: ${found.join(', ')}`);
  return found.length === 0 ? null : { file: found[0], buffer: buffers[0] };
}

export const MANUAL_IMAGE_EXTENSIONS = MANUAL_EXTENSIONS;
