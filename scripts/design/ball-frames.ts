// npm run design:balls
//
// Arma las tiras de cuadros de las Poké Balls que se abren (piel de Pokémon) a partir de las cinco imágenes que aportó el
// usuario (data/pokemon/source/balls/abrir/<nombre>.webp: 7 bolas en fila, de cerrada a abierta, sobre transparente):
//   public/theme/pokemon/balls/abrir/<nombre>.webp   (7 celdas iguales, una al lado de la otra; WebP de calidad 90 con el alfa sin pérdida: sin pérdida pesaban de 200 a 340 KB)
// Cada cuadro se recorta a lo que ocupa y se pega en su celda centrado y con la base apoyada abajo: la mitad de abajo de la
// bola queda quieta de un cuadro al otro y solo sube la tapa. La celda mide lo mismo en las cinco bolas (el cuadro más ancho
// y el más alto de todos). Imprime las medidas que usa el CSS de `BallOpen` y deja una hoja de control en .screenshots/.
// Se corre a mano cuando cambian las imágenes; no se genera nada en cada visita.

import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const SOURCE = path.join(ROOT, 'data', 'pokemon', 'source', 'balls', 'abrir');
const OUTPUT = path.join(ROOT, 'public', 'theme', 'pokemon', 'balls', 'abrir');
const CONTROL = path.join(ROOT, '.screenshots', 'ball-frames.png');
const BALLS = ['poke', 'super', 'ultra', 'veloz', 'master'] as const;
const FRAMES = 7;
/** Alfa desde el que un píxel cuenta como parte de la bola; el resto (el halo del borde) se borra. */
const SOLID = 128;
/** Un tramo de columnas ocupadas más angosto que esto es una mota suelta, no una bola. */
const MIN_FRAME = 40;

interface Frame {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

interface Sheet {
  readonly name: string;
  readonly data: Buffer;
  readonly width: number;
  readonly frames: readonly Frame[];
}

async function read(name: string): Promise<Sheet> {
  const { data, info } = await sharp(path.join(SOURCE, `${name}.webp`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  // Alfa limpio: 0 o 255.
  for (let i = 3; i < data.length; i += 4) data[i] = data[i] >= SOLID ? 255 : 0;
  const solid = (x: number, y: number) => data[(y * width + x) * 4 + 3] === 255;

  const frames: Frame[] = [];
  let start = -1;
  for (let x = 0; x <= width; x += 1) {
    let used = false;
    if (x < width) for (let y = 0; y < height && !used; y += 1) used = solid(x, y);
    if (used && start < 0) start = x;
    if (!used && start >= 0) {
      if (x - start >= MIN_FRAME) {
        let top = height;
        let bottom = -1;
        for (let y = 0; y < height; y += 1) {
          for (let column = start; column < x; column += 1) {
            if (!solid(column, y)) continue;
            top = Math.min(top, y);
            bottom = y;
            break;
          }
        }
        frames.push({ left: start, top, width: x - start, height: bottom - top + 1 });
      }
      start = -1;
    }
  }
  if (frames.length !== FRAMES) throw new Error(`${name}: se esperaban ${FRAMES} cuadros y hay ${frames.length}.`);
  return { name, data, width, frames };
}

const sheets = await Promise.all(BALLS.map(read));
const even = (n: number) => n + (n % 2);
const cellWidth = even(Math.max(...sheets.flatMap((sheet) => sheet.frames.map((frame) => frame.width))));
const cellHeight = even(Math.max(...sheets.flatMap((sheet) => sheet.frames.map((frame) => frame.height))));

await mkdir(OUTPUT, { recursive: true });
await mkdir(path.dirname(CONTROL), { recursive: true });

const strips: Buffer[] = [];
for (const sheet of sheets) {
  const strip = Buffer.alloc(cellWidth * FRAMES * cellHeight * 4);
  sheet.frames.forEach((frame, index) => {
    const offsetX = index * cellWidth + Math.floor((cellWidth - frame.width) / 2);
    const offsetY = cellHeight - frame.height;
    for (let y = 0; y < frame.height; y += 1) {
      const from = ((frame.top + y) * sheet.width + frame.left) * 4;
      const to = ((offsetY + y) * cellWidth * FRAMES + offsetX) * 4;
      sheet.data.copy(strip, to, from, from + frame.width * 4);
    }
  });
  const image = sharp(strip, { raw: { width: cellWidth * FRAMES, height: cellHeight, channels: 4 } });
  await image.clone().webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(OUTPUT, `${sheet.name}.webp`));
  strips.push(await image.png().toBuffer());
  const closed = sheet.frames[0];
  console.log(`${sheet.name}: bola cerrada ${closed.width} × ${closed.height} (${(closed.width / cellWidth).toFixed(4)} del ancho y ${(closed.height / cellHeight).toFixed(4)} del alto de la celda)`);
}

console.log(`Celda: ${cellWidth} × ${cellHeight}; tira: ${cellWidth * FRAMES} × ${cellHeight}`);

// Hoja de control: las cinco tiras apiladas sobre gris, para mirar que los cuadros estén alineados.
await sharp({ create: { width: cellWidth * FRAMES, height: cellHeight * BALLS.length, channels: 4, background: { r: 128, g: 128, b: 128, alpha: 1 } } })
  .composite(strips.map((input, index) => ({ input, left: 0, top: index * cellHeight })))
  .png()
  .toFile(CONTROL);
