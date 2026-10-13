// npm run design:assets
//
// Escribe los SVG estáticos de las pieles (SPEC 9.2) en public/theme/<franquicia>/ a partir de los mapas de
// bits en texto de src/franchises/<franquicia>/theme/art.ts, con los colores de su paleta (palette.ts).
// Así el dibujo tiene una sola fuente: se corrige el mapa de bits y se vuelve a correr. Sin dependencias.
// Con --check no escribe nada: falla si algún archivo no coincide con su dibujo.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { bitmapSvg } from '../../src/components/ui/bitmap.ts';
import { POKEMON_PALETTE } from '../../src/franchises/pokemon/palette.ts';
import { STATIC_ASSETS as pokemonAssets, fileArt } from '../../src/franchises/pokemon/theme/art.ts';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

/** Las pieles que tienen archivos estáticos: su carpeta, su paleta y sus dibujos. */
const SKINS = [{ slug: 'pokemon', palette: POKEMON_PALETTE, assets: pokemonAssets }];

const check = process.argv.includes('--check');
let stale = 0;

for (const { slug, palette, assets } of SKINS) {
  const dir = path.join(ROOT, 'public', 'theme', slug);
  await mkdir(dir, { recursive: true });
  for (const { file, art } of assets) {
    const target = path.join(dir, file);
    const svg = bitmapSvg(fileArt(art, palette));
    const current = await readFile(target, 'utf8').catch(() => null);
    if (current === svg) continue;
    if (check) {
      stale++;
      console.error(`Desactualizado: public/theme/${slug}/${file}`);
    } else {
      await writeFile(target, svg);
      console.log(`Escrito: public/theme/${slug}/${file}`);
    }
  }
}

if (stale > 0) {
  console.error(`${stale} archivo(s) no coinciden con su dibujo. Corré npm run design:assets.`);
  process.exit(1);
}
