import { readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { expect, it } from 'vitest';
import { compile } from 'sass';
import { POKEMON_PALETTE } from '../palette';
import { landscapeAssets } from './landscape-art';

it('publica los cuatro mosaicos propios, pequeños, opacos en agua y orillas y con la paleta existente', async () => {
  const root = path.resolve(import.meta.dirname, '../../../..');
  const palette = new Set(Object.values(POKEMON_PALETTE));
  for (const [name, svg] of Object.entries(landscapeAssets())) {
    expect(readFileSync(path.join(root, 'public/theme/pokemon', name), 'utf8')).toBe(svg);
    expect(Buffer.byteLength(svg)).toBeLessThan(25000);
    expect(svg).not.toMatch(/<script|https?:\/\/(?!www.w3.org)|<image|<animate/);
    for (const color of svg.match(/#[0-9a-f]{6}/g) ?? []) expect(palette.has(color as typeof POKEMON_PALETTE[keyof typeof POKEMON_PALETTE])).toBe(true);
    const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(info.width).toBe(name === 'trees.svg' ? 256 : 96);
    if (name !== 'trees.svg') for (let i = 3; i < data.length; i += 4) expect(data[i]).toBe(255);
  }
});

it('el bosque conserva la grilla, troncos separados y una base continua sin curvas ni degradados', async () => {
  const svg = landscapeAssets()['trees.svg'];
  expect(svg).not.toMatch(/<circle|<ellipse|<.*Gradient|[CQ]\d/);
  const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  expect([info.width, info.height]).toEqual([256, 24]);
  const rgb = (x: number, y: number) => `#${[...data.subarray((y * 256 + x) * 4, (y * 256 + x) * 4 + 3)].map(n => n.toString(16).padStart(2, '0')).join('')}`;
  const trunks = [POKEMON_PALETTE.orange, POKEMON_PALETTE.dawn];
  let groups = 0, previous = false;
  const tops = new Set<number>();
  for (let x = 0; x < 256; x++) {
    expect(data[(23 * 256 + x) * 4 + 3]).toBe(255);
    const trunk = trunks.includes(rgb(x, 23) as typeof trunks[number]);
    if (trunk && !previous) groups++;
    previous = trunk;
    for (let y = 0; y < 24; y++) if (data[(y * 256 + x) * 4 + 3]) { tops.add(y); break; }
  }
  expect(groups).toBeGreaterThanOrEqual(12);
  expect(tops.size).toBeGreaterThanOrEqual(8);
});

it('la tierra lejana separa cuatro filas de pasto y dos de suelo, sin troncos sobre el agua', async () => {
  const { data, info } = await sharp(Buffer.from(landscapeAssets()['far-bank.svg'])).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  expect([info.width, info.height]).toEqual([96, 6]);
  const color = (x: number, y: number) => `#${[...data.subarray((y * 96 + x) * 4, (y * 96 + x) * 4 + 3)].map(n => n.toString(16).padStart(2, '0')).join('')}`;
  const grass = [POKEMON_PALETTE['grass-1'], POKEMON_PALETTE['grass-2'], POKEMON_PALETTE['grass-3']];
  for (let x = 0; x < 96; x++) {
    for (let y = 0; y < 4; y++) expect(grass).toContain(color(x, y));
    expect([POKEMON_PALETTE.orange, POKEMON_PALETTE.dawn]).toContain(color(x, 4));
    expect([POKEMON_PALETTE.orange, POKEMON_PALETTE.ink, POKEMON_PALETTE.blue]).toContain(color(x, 5));
  }
});

it('reserva la tierra dentro del mismo clamp y alinea el agua debajo sin alterar el pasto', () => {
  const css = compile(path.join(import.meta.dirname, 'Backdrop.module.scss'), {
    loadPaths: [path.resolve(import.meta.dirname, '../../../..', 'src/styles')],
  }).css;
  // The residual water height keeps the sum invariant at every viewport and root font size.
  expect(css).toContain('--landscape-h: clamp(4rem, 15dvh, 9rem)');
  expect(css).toContain('--far-bank-h: calc(var(--trees-h) * 0.25)');
  expect(css).toContain('--water-h: calc(var(--landscape-h) - var(--trees-h) - var(--far-bank-h) - var(--bank-h))');
  expect(css).toContain('inset-block-start: calc(var(--water-top) - var(--far-bank-h))');
  expect(css).toContain('--water-top: calc(100% - var(--ground-h) - var(--bank-h) - var(--water-h))');
  expect(css).toContain('--ground-h: clamp(11.2rem, 35dvh, 14rem)');
  expect(css).toContain('--ground-h: clamp(14rem, 32.2dvh, 21rem)');
  expect(css).toContain('--ground-h: 9.8rem');
});
