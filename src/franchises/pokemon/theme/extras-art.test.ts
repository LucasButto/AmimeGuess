import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { POKEMON_PALETTE } from '../palette';
import { MEDAL_COUNT, TYPE_NAMES, medal, typeBadgeFile } from './extras-art';

const palette: Readonly<Record<string, string>> = POKEMON_PALETTE;

describe('archivos de insignias de tipo', () => {
  it('los 18 tipos tienen archivos distintos y existentes', () => {
    const directory = path.resolve(import.meta.dirname, '../../../../public/theme/pokemon/tipos');
    const files = TYPE_NAMES.map(typeBadgeFile);
    expect(files).toHaveLength(18);
    expect(new Set(files).size).toBe(18);
    expect(readdirSync(directory).sort()).toEqual([...files].sort());
    for (const file of files) {
      expect(file).toMatch(/^[a-z]+\.png$/);
      expect(existsSync(path.join(directory, file)), file).toBe(true);
      const png = readFileSync(path.join(directory, file));
      expect([...png.subarray(0, 8)], file).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      expect(png.toString('ascii', 12, 16), file).toBe('IHDR');
      expect([png.readUInt32BE(16), png.readUInt32BE(20)], file).toEqual([50, 50]);
    }
  });
});

describe('medallas de racha', () => {
  it('ocho medallas de 8 × 8 con colores de la paleta, encendidas y apagadas', () => {
    expect(MEDAL_COUNT).toBe(8);
    for (let index = 0; index < MEDAL_COUNT; index++) {
      for (const lit of [true, false]) {
        const art = medal(index, lit);
        expect(art.rows).toHaveLength(8);
        for (const row of art.rows) expect(row).toHaveLength(8);
        for (const row of art.rows) for (const char of row) expect(char === '.' || char in art.colors).toBe(true);
        for (const name of Object.values(art.colors)) expect(palette[name], name).toBeDefined();
      }
    }
  });
});
