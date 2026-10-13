import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../../theme';
import { POKEMON_PALETTE } from '../palette';
import { MEDAL_COUNT, TYPE_NAMES, medal, typeIcon } from './extras-art';

const palette: Readonly<Record<string, string>> = POKEMON_PALETTE;

describe('íconos de tipo', () => {
  it('hay uno por cada uno de los 18 tipos, de 8 × 8', () => {
    expect(TYPE_NAMES).toHaveLength(18);
    for (const type of TYPE_NAMES) {
      const { art } = typeIcon(type);
      expect(art.rows, type).toHaveLength(8);
      for (const row of art.rows) expect(row, type).toHaveLength(8);
    }
  });

  it('todos los dibujos son distintos', () => {
    expect(new Set(TYPE_NAMES.map((type) => typeIcon(type).art.rows.join('/'))).size).toBe(18);
  });

  it('el trazo del ícono contrasta con su píldora (3:1, componente de interfaz)', () => {
    for (const type of TYPE_NAMES) {
      const { fill, ink } = typeIcon(type);
      expect(palette[fill], `${type}: ${fill}`).toBeDefined();
      expect(contrastRatio(palette[ink], palette[fill]), type).toBeGreaterThanOrEqual(3);
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
