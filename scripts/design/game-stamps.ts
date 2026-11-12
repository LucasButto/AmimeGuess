// Originales aportados por el usuario. Licencia: A confirmar. Se conservan fuera de public/.
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '../..');
for (const franchise of ['naruto', 'dragon-ball']) {
  const output = path.join(root, 'public/icons', franchise);
  await mkdir(output, { recursive: true });
  for (const name of ['logrado', 'fallaste']) {
    const input = path.join(root, 'data', franchise, 'source', 'icons', `${name}.png`);
    const target = path.join(output, `${name}.webp`);
    const result = await sharp(input).resize({ width: 720, withoutEnlargement: true }).webp({ quality: 85, alphaQuality: 90, effort: 6 }).toFile(target);
    const before = (await stat(input)).size;
    console.log(`${franchise}/${name}: ${before} → ${result.size} bytes (${result.width}×${result.height}, -${(100 - result.size / before * 100).toFixed(1)}%)`);
  }
}
