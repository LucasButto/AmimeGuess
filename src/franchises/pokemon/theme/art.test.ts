import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { bitmapSvg } from '../../../components/ui/bitmap';
import { pokemonConfig } from '../config';
import { BALL_BOTTOM_ROWS, BALL_TOP_ROWS, STATIC_ASSETS, fileArt } from './art';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..', '..');

describe('pixel art de Pokémon', () => {
  it('cada dibujo usa solo colores de la paleta y filas del mismo ancho', () => {
    for (const { file, art } of STATIC_ASSETS) {
      for (const name of Object.values(art.colors)) expect(pokemonConfig.theme.palette, `${file}: ${name}`).toHaveProperty(name);
      expect(new Set(art.rows.map((row) => row.length)).size, file).toBe(1);
      for (const row of art.rows) for (const char of row) expect(char === '.' || char in art.colors, `${file}: ${char}`).toBe(true);
    }
  });

  it('los SVG de public/theme/pokemon/ coinciden con su dibujo (si no, correr npm run design:assets)', () => {
    for (const { file, art } of STATIC_ASSETS) {
      const svg = readFileSync(path.join(ROOT, 'public', 'theme', 'pokemon', file), 'utf8');
      expect(svg, file).toBe(bitmapSvg(fileArt(art, pokemonConfig.theme.palette)));
    }
  });

  it('las dos mitades de la bola forman un dibujo de 12 × 12', () => {
    expect([...BALL_TOP_ROWS, ...BALL_BOTTOM_ROWS]).toHaveLength(12);
    for (const row of [...BALL_TOP_ROWS, ...BALL_BOTTOM_ROWS]) expect(row).toHaveLength(12);
  });
});
