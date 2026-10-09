// Conversión del arte oficial a WebP en dos tamaños (SPEC sección 7, "Imágenes").
// Toda la optimización ocurre acá, antes del despliegue: el sitio solo sirve
// archivos estáticos de public/img/.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

/** Lado mayor en píxeles de cada variante. */
export const SIZES = [256, 512] as const;
export type Size = (typeof SIZES)[number];

/** Presupuesto del arte oficial: ≤ 25 KB la de 256 px y ≤ 70 KB la de 512 px. */
export const BUDGET_BYTES: Record<Size, number> = { 256: 25 * 1024, 512: 70 * 1024 };

/**
 * Cómo se comprime un tipo de imagen. Se prueba de la mejor calidad hacia abajo
 * y se queda con la primera que entra en el presupuesto. El resultado depende
 * solo de la imagen, así que ejecutar el script dos veces da archivos idénticos
 * byte a byte.
 */
export interface RenderOptions {
  readonly qualities: readonly number[];
  readonly budget: Readonly<Record<Size, number>>;
  /** Calidad del canal alfa (0 a 100). Por defecto 100: sin pérdida, que es lo que necesita el arte con bordes finos. */
  readonly alphaQuality?: number;
}

export const ARTWORK: RenderOptions = {
  qualities: [90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40],
  budget: BUDGET_BYTES,
};

/**
 * Cartas del TCG (sesión 05): ≤ 60 KB la de 512 px. Empiezan en calidad 70 y no en 90
 * porque se muestran borrosas y son ~2050 cartas: así `public/img` se queda bajo los
 * 150 MB de la SPEC (con calidad 90 pasaría de 190 MB).
 */
export const CARD: RenderOptions = {
  qualities: [70, 65, 60, 55, 50, 45, 40],
  budget: { 256: 25 * 1024, 512: 60 * 1024 },
};

export interface Rendered {
  id: string;
  size: Size;
  bytes: number;
  quality: number;
}

export function imageFileName(id: string, size: Size): string {
  return `${id}-${size}.webp`;
}

async function encode(source: Buffer, size: Size, options: RenderOptions): Promise<{ buffer: Buffer; quality: number }> {
  // El arte oficial mide 475 px: la variante de 512 es un reescalado leve.
  const { data, info } = await sharp(source)
    .resize({ width: size, height: size, fit: 'inside' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (const quality of options.qualities) {
    // effort 4 pesa 1-2 % más que el 6 pero codifica ~60 veces más rápido
    // (30 ms contra 1,8 s por imagen): el script se puede volver a correr.
    const buffer = await sharp(data, { raw: info })
      .webp({ quality, alphaQuality: options.alphaQuality ?? 100, effort: 4, smartSubsample: true })
      .toBuffer();
    if (buffer.length <= options.budget[size]) return { buffer, quality };
  }
  throw new Error(
    `no entra en ${options.budget[size] / 1024} KB ni con calidad ${options.qualities[options.qualities.length - 1]}`,
  );
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
export async function renderImage(
  id: string,
  source: Buffer,
  directory: string,
  options: RenderOptions = ARTWORK,
): Promise<Rendered[]> {
  await mkdir(directory, { recursive: true });
  const rendered: Rendered[] = [];
  for (const size of SIZES) {
    try {
      const { buffer, quality } = await encode(source, size, options);
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
