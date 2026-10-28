import { readFileSync } from 'node:fs';
import path from 'node:path';
import { compile } from 'sass';
import { describe, expect, it } from 'vitest';
import { franchises } from '@/franchises';
import { contrastRatio, themeColor } from '@/franchises/theme';

const source = readFileSync(path.join(import.meta.dirname, 'page.module.scss'), 'utf8');
const colors = Object.fromEntries([...source.matchAll(/--hub-([a-z-]+):\s*(#[0-9a-f]{6});/g)].map(([, name, hex]) => [name, hex]));

describe('contraste del hub nocturno', () => {
  it.each([
    ['ink', 'night'], ['ink', 'wall'], ['muted', 'night'], ['muted', 'wall'],
    ['focus', 'night'], ['focus', 'wall'],
  ])('%s sobre %s pasa AA de texto', (ink, paper) => {
    expect(contrastRatio(colors[ink], colors[paper])).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ['pokemon', 'ink', 'cream'], ['dragon-ball', 'ink', 'cream'],
    ['naruto', 'ink', 'paper'], ['yugioh', 'gold', 'tomb'],
  ])('el nombre de %s se lee sobre su etiqueta', (slug, ink, paper) => {
    const theme = franchises.find((franchise) => franchise.slug === slug)!.theme;
    expect(contrastRatio(themeColor(theme, ink)!, themeColor(theme, paper)!)).toBeGreaterThanOrEqual(4.5);
  });

  it('el foco se distingue de ranura, pared y carcasa', () => {
    for (const background of ['slot', 'night', 'wall', 'case', 'case-light']) {
      expect(contrastRatio(colors.focus, colors[background]), background).toBeGreaterThanOrEqual(3);
    }
  });

  it('el pie base conserva texto, enlace y foco AA sobre su superficie propia', () => {
    const tokens = readFileSync(path.resolve(import.meta.dirname, '../styles/_tokens.scss'), 'utf8');
    const block = tokens.slice(tokens.indexOf('$colors: ('), tokens.indexOf(');', tokens.indexOf('$colors: (')));
    const base = Object.fromEntries([...block.matchAll(/'([a-z-]+)':\s*(#[0-9a-f]{6})/g)].map(([, name, hex]) => [name, hex]));
    for (const ink of ['text-muted', 'accent']) expect(contrastRatio(base[ink], base.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(base.focus, base.surface)).toBeGreaterThanOrEqual(3);
  });

  it('las hojas del hub compilan con los tokens y mixins existentes', () => {
    for (const file of ['page', 'FranchiseCard']) {
      expect(compile(path.join(import.meta.dirname, `${file}.module.scss`), {
        loadPaths: [path.resolve(import.meta.dirname, '../styles')],
      }).css.length).toBeGreaterThan(0);
    }
  });
});
