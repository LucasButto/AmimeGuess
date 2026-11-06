import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const root = path.resolve(import.meta.dirname, '../..');
for (const [source, destination] of [['shared', 'common'], ['naruto', 'naruto']]) {
  await mkdir(path.join(root, 'public/img', destination), { recursive: true });
  for (const size of [256, 512]) {
    await sharp(path.join(root, `data-src/${source}/icons/roulette-question.png`))
      .resize(size, size, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85, effort: 6 })
      .toFile(path.join(root, `public/img/${destination}/roulette-question-${size}.webp`));
  }
}
