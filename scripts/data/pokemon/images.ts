// Conversión del arte oficial a WebP en dos tamaños (SPEC sección 7, "Imágenes").
// Toda la optimización ocurre acá, antes del despliegue: el sitio solo sirve
// archivos estáticos de public/img/.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

/** Lado mayor en píxeles de cada variante. */
export const SIZES = [256, 512] as const;
export type Size = (typeof SIZES)[number];

/** Presupuesto de la sesión: ≤ 25 KB la de 256 px y ≤ 70 KB la de 512 px. */
export const BUDGET_BYTES: Record<Size, number> = { 256: 25 * 1024, 512: 70 * 1024 };

// Se prueba de la mejor calidad hacia abajo y se queda con la primera que entra
// en el presupuesto. El resultado depende solo de la imagen, así que ejecutar
// el script dos veces da archivos idénticos byte a byte.
const QUALITIES = [90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40];

export interface Rendered {
  id: string;
  size: Size;
  bytes: number;
  quality: number;
}

export function imageFileName(id: string, size: Size): string {
  return `${id}-${size}.webp`;
}

async function encode(source: Buffer, size: Size): Promise<{ buffer: Buffer; quality: number }> {
  // El arte oficial mide 475 px: la variante de 512 es un reescalado leve.
  const { data, info } = await sharp(source)
    .resize({ width: size, height: size, fit: 'inside' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (const quality of QUALITIES) {
    // effort 4 pesa 1-2 % más que el 6 pero codifica ~60 veces más rápido
    // (30 ms contra 1,8 s por imagen): el script se puede volver a correr.
    const buffer = await sharp(data, { raw: info })
      .webp({ quality, alphaQuality: 100, effort: 4, smartSubsample: true })
      .toBuffer();
    if (buffer.length <= BUDGET_BYTES[size]) return { buffer, quality };
  }
  throw new Error(`no entra en ${BUDGET_BYTES[size] / 1024} KB ni con calidad ${QUALITIES[QUALITIES.length - 1]}`);
}

/** Escribe el archivo solo si cambió: una segunda ejecución no toca nada. */
async function writeIfChanged(file: string, data: Buffer): Promise<void> {
  try {
    if ((await readFile(file)).equals(data)) return;
  } catch {
    // No existe todavía.
  }
  await writeFile(file, data);
}

/** Convierte una imagen fuente a los dos tamaños y los guarda en `directory`. */
export async function renderImage(id: string, source: Buffer, directory: string): Promise<Rendered[]> {
  await mkdir(directory, { recursive: true });
  const rendered: Rendered[] = [];
  for (const size of SIZES) {
    try {
      const { buffer, quality } = await encode(source, size);
      await writeIfChanged(path.join(directory, imageFileName(id, size)), buffer);
      rendered.push({ id, size, bytes: buffer.length, quality });
    } catch (error) {
      throw new Error(`${id} (${size} px): ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return rendered;
}

/** Dimensiones reales de un WebP ya guardado, para verificar que el lado mayor es el esperado. */
export async function imageDimensions(file: string): Promise<{ width: number; height: number; format: string }> {
  const meta = await sharp(file).metadata();
  return { width: meta.width ?? 0, height: meta.height ?? 0, format: meta.format ?? '' };
}
