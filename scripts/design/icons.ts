// npm run design:icons
//
// Genera los íconos instalables (PNG estáticos, SPEC 7) a partir de scripts/design/app-icon-source.webp, la imagen del ícono
// que aportó el usuario (un globo de cómic con un signo de pregunta, en pixel art, sobre un cuadrado naranja):
//   public/icons/icon-192.png · icon-512.png   (propósito "any": el cuadrado con esquinas redondeadas y las esquinas transparentes)
//   public/icons/icon-maskable-512.png         (propósito "maskable": a sangre sobre el naranja y con el dibujo en la zona segura)
//   src/app/apple-icon.png                     (iOS, 180 × 180: a sangre y sin transparencia; iOS le pone las esquinas)
//   src/app/icon.png                           (favicon de la pestaña, 96 × 96: solo el globo con el "?", sin el cuadrado naranja)
// Se corre a mano cuando cambia la imagen; no se genera nada en cada visita.

import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const SOURCE = path.join(import.meta.dirname, 'app-icon-source.webp');
/** El naranja del cuadrado de la imagen: rellena los íconos que van a sangre y es el color de la app al abrirse. */
const BACKGROUND = { r: 253, g: 100, b: 8 };
/**
 * Zona segura de un ícono "maskable": un círculo centrado del 80 % del lado. Los puntos más lejanos del dibujo (la punta del
 * globo y los destellos) quedan dentro de ese círculo a esta escala.
 */
const MASKABLE_SCALE = 0.78;
/** Un píxel casi negro conectado con el borde de la imagen es el exterior del cuadrado redondeado. */
const OUTSIDE_MAX = 40;

const { data, info } = await sharp(SOURCE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height } = info;

/** Hace transparentes las esquinas negras de afuera del cuadrado (relleno desde el borde, sin tocar el contorno del dibujo). */
function clearOutside(): void {
  const dark = (i: number) => data[i] <= OUTSIDE_MAX && data[i + 1] <= OUTSIDE_MAX && data[i + 2] <= OUTSIDE_MAX;
  const seen = new Uint8Array(width * height);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    const at = y * width + x;
    if (seen[at] || !dark(at * 4)) return;
    seen[at] = 1;
    stack.push(at);
  };
  for (let x = 0; x < width; x++) { push(x, 0); push(x, height - 1); }
  for (let y = 0; y < height; y++) { push(0, y); push(width - 1, y); }
  while (stack.length > 0) {
    const at = stack.pop()!;
    data[at * 4 + 3] = 0;
    const x = at % width, y = Math.floor(at / width);
    if (x > 0) push(x - 1, y);
    if (x < width - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < height - 1) push(x, y + 1);
  }
}
clearOutside();

/** El borde del cuadrado tiene un píxel de transición oscuro: se saca un poco hacia adentro para que no se vea como una línea. */
function shrinkEdge(passes: number): void {
  for (let pass = 0; pass < passes; pass++) {
    const clear: number[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const at = y * width + x;
        if (data[at * 4 + 3] === 0) continue;
        const near = (x > 0 && data[(at - 1) * 4 + 3] === 0) || (x < width - 1 && data[(at + 1) * 4 + 3] === 0)
          || (y > 0 && data[(at - width) * 4 + 3] === 0) || (y < height - 1 && data[(at + width) * 4 + 3] === 0);
        if (near) clear.push(at);
      }
    }
    for (const at of clear) data[at * 4 + 3] = 0;
  }
}
shrinkEdge(4);

const rounded = () => sharp(data, { raw: { width, height, channels: 4 } });
/** El ícono con esquinas transparentes a `side` píxeles de lado. */
const art = (side: number) => rounded().resize(side, side).png().toBuffer();

/** Un ícono a sangre: el naranja en todo el lienzo y el dibujo escalado en el centro. */
async function fullBleed(side: number, scale: number): Promise<Buffer> {
  const inner = Math.round(side * scale);
  return sharp({ create: { width: side, height: side, channels: 3, background: BACKGROUND } })
    .composite([{ input: await art(inner), gravity: 'centre' }])
    .removeAlpha()
    .png()
    .toBuffer();
}

/**
 * El favicon se ve a 16 o 32 px: ahí el cuadrado naranja le quita lugar al dibujo. Se deja solo el globo con el signo de
 * pregunta: el naranja pasa a transparente, se queda con la pieza más grande (el globo, con todo lo que tiene adentro; los
 * destellos sueltos quedan afuera) y se recorta justo a su caja.
 */
async function bubbleOnly(side: number): Promise<Buffer> {
  const { data: raw } = await sharp(SOURCE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = Buffer.from(raw);
  for (let at = 0; at < width * height; at++) {
    const distance = Math.hypot(px[at * 4] - BACKGROUND.r, px[at * 4 + 1] - BACKGROUND.g, px[at * 4 + 2] - BACKGROUND.b);
    if (distance < 60) px[at * 4 + 3] = 0;
  }
  // La pieza opaca más grande (conectada por los lados).
  const label = new Int32Array(width * height).fill(-1);
  const sizes: number[] = [];
  for (let start = 0; start < width * height; start++) {
    if (px[start * 4 + 3] === 0 || label[start] !== -1) continue;
    const id = sizes.length;
    let count = 0;
    const stack = [start];
    label[start] = id;
    while (stack.length > 0) {
      const at = stack.pop()!;
      count++;
      const x = at % width, y = Math.floor(at / width);
      for (const next of [x > 0 ? at - 1 : -1, x < width - 1 ? at + 1 : -1, y > 0 ? at - width : -1, y < height - 1 ? at + width : -1]) {
        if (next >= 0 && label[next] === -1 && px[next * 4 + 3] !== 0) {
          label[next] = id;
          stack.push(next);
        }
      }
    }
    sizes.push(count);
  }
  const biggest = sizes.indexOf(Math.max(...sizes));
  let minX = width, minY = height, maxX = 0, maxY = 0;
  for (let at = 0; at < width * height; at++) {
    if (label[at] !== biggest) { px[at * 4 + 3] = 0; continue; }
    const x = at % width, y = Math.floor(at / width);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const box = Math.max(maxX - minX, maxY - minY) + 1;
  const left = Math.max(0, Math.round((minX + maxX + 1) / 2 - box / 2));
  const top = Math.max(0, Math.round((minY + maxY + 1) / 2 - box / 2));
  const cropped = await sharp(px, { raw: { width, height, channels: 4 } })
    .extract({ left, top, width: Math.min(box, width - left), height: Math.min(box, height - top) })
    .resize(side, side, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  return cropped;
}

await mkdir(path.join(ROOT, 'public', 'icons'), { recursive: true });
const outputs: Array<[string, Buffer]> = [
  [path.join(ROOT, 'public', 'icons', 'icon-192.png'), await art(192)],
  [path.join(ROOT, 'public', 'icons', 'icon-512.png'), await art(512)],
  [path.join(ROOT, 'public', 'icons', 'icon-maskable-512.png'), await fullBleed(512, MASKABLE_SCALE)],
  [path.join(ROOT, 'src', 'app', 'apple-icon.png'), await fullBleed(180, 1)],
  [path.join(ROOT, 'src', 'app', 'icon.png'), await bubbleOnly(96)],
];
for (const [file, data] of outputs) {
  await sharp(data).toFile(file);
  console.log(`${path.relative(ROOT, file)} (${data.length} bytes)`);
}
