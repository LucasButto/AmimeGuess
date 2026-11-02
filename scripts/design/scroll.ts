// npm run design:scroll
//
// Prepara el pergamino de los íconos de la lista de modos de Naruto en el teléfono (public/theme/naruto/pergamino.png) a
// partir de scripts/design/naruto-scroll-source.webp, la imagen que aportó el usuario (un pergamino con un rodillo oscuro a la
// izquierda y bandas granates, sobre fondo blanco). El blanco de afuera pasa a transparente (relleno desde el borde: el papel
// crema de adentro no se toca), se recorta a la caja del dibujo y se achica. También escribe, en la salida, dónde queda el
// papel dentro del dibujo (en %), para que el ícono de cada modo se ponga justo encima. Archivo estático, nunca por visita.

import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const SOURCE = path.join(import.meta.dirname, 'naruto-scroll-source.webp');
const TARGET = path.join(ROOT, 'public', 'theme', 'naruto', 'pergamino.png');
/** Ancho final en píxeles (el ícono se ve a unos 52 px de ancho: 4 veces eso alcanza para pantallas de mucha densidad). */
const WIDTH = 224;
/** Un píxel casi blanco conectado con el borde es el fondo. */
const OUTSIDE_MIN = 240;

const { data, info } = await sharp(SOURCE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height } = info;

const light = (at: number) => data[at * 4] >= OUTSIDE_MIN && data[at * 4 + 1] >= OUTSIDE_MIN && data[at * 4 + 2] >= OUTSIDE_MIN;
const seen = new Uint8Array(width * height);
const stack: number[] = [];
const push = (x: number, y: number) => {
  const at = y * width + x;
  if (seen[at] || !light(at)) return;
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
// El borde del dibujo tiene un contorno suave contra el blanco: se saca un píxel de transición hacia adentro.
for (let pass = 0; pass < 2; pass++) {
  const clear: number[] = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const at = y * width + x;
      if (data[at * 4 + 3] === 0) continue;
      if (data[(at - 1) * 4 + 3] === 0 || data[(at + 1) * 4 + 3] === 0 || data[(at - width) * 4 + 3] === 0 || data[(at + width) * 4 + 3] === 0) {
        if (data[at * 4] > 200 && data[at * 4 + 1] > 200 && data[at * 4 + 2] > 200) clear.push(at);
      }
    }
  }
  for (const at of clear) data[at * 4 + 3] = 0;
}

let minX = width, minY = height, maxX = 0, maxY = 0;
for (let at = 0; at < width * height; at++) {
  if (data[at * 4 + 3] === 0) continue;
  const x = at % width, y = Math.floor(at / width);
  minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
}
const box = { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };

// El papel: los píxeles crema (el color del centro) y su caja, dentro de la caja del dibujo.
const paper = (at: number) => Math.abs(data[at * 4] - 235) < 14 && Math.abs(data[at * 4 + 1] - 225) < 14 && Math.abs(data[at * 4 + 2] - 204) < 16 && data[at * 4 + 3] > 0;
let pMinX = width, pMinY = height, pMaxX = 0, pMaxY = 0;
for (let at = 0; at < width * height; at++) {
  if (!paper(at)) continue;
  const x = at % width, y = Math.floor(at / width);
  pMinX = Math.min(pMinX, x); pMaxX = Math.max(pMaxX, x); pMinY = Math.min(pMinY, y); pMaxY = Math.max(pMaxY, y);
}

await mkdir(path.dirname(TARGET), { recursive: true });
await sharp(data, { raw: { width, height, channels: 4 } })
  .extract(box)
  .resize({ width: WIDTH })
  .png({ compressionLevel: 9 })
  .toFile(TARGET);

const pct = (value: number, total: number) => `${((100 * value) / total).toFixed(1)}%`;
console.log(`${path.relative(ROOT, TARGET)}: ${WIDTH} × ${Math.round((WIDTH * box.height) / box.width)} px (proporción ${(box.width / box.height).toFixed(3)})`);
console.log(
  `papel dentro del dibujo: izquierda ${pct(pMinX - box.left, box.width)}, arriba ${pct(pMinY - box.top, box.height)}, ` +
    `derecha ${pct(box.left + box.width - 1 - pMaxX, box.width)}, abajo ${pct(box.top + box.height - 1 - pMaxY, box.height)}`,
);
