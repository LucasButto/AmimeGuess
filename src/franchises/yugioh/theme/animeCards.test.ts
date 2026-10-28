import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import sharp from 'sharp';
import { compile } from 'sass';
import { describe, expect, it, vi } from 'vitest';
import type { Content, Entity } from '@/engine/types';
import { AnimeCard } from './AnimeCard';
import { AnimeComparisonMedia } from './AnimeGameCards';
import { attributeIcon, cardNameKey, indexAnimeCards, numericCardValue } from './animeCards';

vi.mock('./AnimeCard.module.scss', () => ({ default: { orb: 'orb' } }));
vi.mock('./AnimeGameCards.module.scss', () => ({ default: { lesser: 'lesser' } }));
vi.mock('./CardBack.module.scss', () => ({ default: {} }));
vi.mock('@/components/VisuallyHidden.module.scss', () => ({ default: { root: 'visually-hidden' } }));
const root = path.resolve(import.meta.dirname, '../../../..');
const cards = JSON.parse(readFileSync(path.join(root, 'data/yugioh/cards.json'), 'utf8')) as Entity[];
const contents = JSON.parse(readFileSync(path.join(root, 'data/yugioh/content.json'), 'utf8')) as Content[];
const sample: Entity = { ...cards[0], attrs: { clase: 'Monstruo Normal', atributo: 'LUZ', nivel: 7, atk: 12345, def: 67890 } };

describe('atributos de la referencia del usuario', () => {
  it('cubre todos los valores reales sin cambiar acentos ni datos', () => {
    for (const card of cards) expect(attributeIcon(card.attrs.atributo), card.id).toBeTruthy();
    expect(attributeIcon('MÁGICA')).toBe('/theme/yugioh/atributos/magia.webp');
    expect(attributeIcon('desconocido')).toBeUndefined();
    expect(attributeIcon(null)).toBeUndefined();
  });
  it('los nueve recortes son cuadrados de 128, con alfa y esquinas transparentes', async () => {
    const names = ['oscuridad', 'luz', 'agua', 'viento', 'tierra', 'fuego', 'magia', 'trampa', 'divino'];
    for (const name of names) {
      const file = path.join(root, 'public/theme/yugioh/atributos', `${name}.webp`);
      expect(existsSync(file)).toBe(true);
      const metadata = await sharp(file).metadata();
      expect([metadata.width, metadata.height, metadata.hasAlpha]).toEqual([128, 128, true]);
      const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      for (const [x, y] of [[0, 0], [127, 0], [0, 127], [127, 127]]) expect(data[(y * info.width + x) * 4 + 3]).toBe(0);
      expect(data.some((value, index) => index % 4 === 3 && value === 255)).toBe(true);
    }
  });
});

describe('cartas del anime sin pistas accidentales', () => {
  it.each(['atk', 'def', 'nivel'])('la lectura accesible de %s solo se incorpora al revelar', (metric) => {
    const before = renderToStaticMarkup(createElement(AnimeComparisonMedia, { entity: sample, metric, revealed: false }));
    expect(before).not.toContain('data-anime-comparison-summary');
    if (metric === 'atk') expect(before).not.toContain('12.345');
    if (metric === 'def') expect(before).not.toContain('67.890');
    const after = renderToStaticMarkup(createElement(AnimeComparisonMedia, { entity: sample, metric, revealed: true }));
    expect(after).toContain('data-anime-comparison-summary');
    expect(after).toContain('class="visually-hidden"');
    expect(after).toContain(numericCardValue(sample.attrs[metric]));
    expect(after).toContain('data-anime-comparison-lower');
    expect(before).toMatch(/data-anime-choice="true" aria-hidden="true"/);
    expect(after).toMatch(/data-anime-choice="true" aria-hidden="true"/);
  });
  it.each(['atk', 'def', 'nivel'] as const)('oculta %s tanto en el dibujo como en el nombre accesible', (hidden) => {
    const html = renderToStaticMarkup(createElement(AnimeCard, { card: sample, hidden }));
    expect(html).toContain('oculto');
    if (hidden === 'atk') expect(html).not.toContain('12.345');
    if (hidden === 'def') expect(html).not.toContain('67.890');
    // Las esferas son la tira de imagen del nivel (nivel-07.webp): con el nivel oculto no se escribe.
    expect(html.match(/data-level="7"/g)?.length ?? 0).toBe(hidden === 'nivel' ? 0 : 1);
    expect(html.includes('nivel-07.webp')).toBe(hidden !== 'nivel');
  });
  it('al revelar aparecen los tres datos y nunca más de doce círculos', () => {
    const html = renderToStaticMarkup(createElement(AnimeCard, { card: { ...sample, attrs: { ...sample.attrs, nivel: 15 } } }));
    expect(html).toContain('12.345');
    expect(html).toContain('67.890');
    expect(html).toContain('Nivel / rango: 15');
    expect(html).toContain('nivel-12.webp');
    expect(html).not.toContain('nivel-15.webp');
    expect(html).not.toContain('oculto');
  });
  it.each(['Carta Mágica', 'Carta de Trampa'])('%s no presenta nivel, ATK ni DEF', (clase) => {
    const html = renderToStaticMarkup(createElement(AnimeCard, { card: { ...sample, attrs: { ...sample.attrs, clase } } }));
    expect(html).not.toContain('data-anime-stat');
    expect(html).not.toContain('12.345');
    expect(html).not.toContain('ATK:');
  });
  it('representa valores desconocidos sin inventarlos', () => {
    expect(numericCardValue(null)).toBe('?');
    expect(numericCardValue('3000')).toBe('?');
    expect(numericCardValue(0)).toBe('0');
  });
});

it('todos los eslabones actuales de Deck e Invocación tienen carta e ilustración', () => {
  const index = indexAnimeCards(cards);
  let count = 0;
  for (const content of contents.filter((entry) => entry.kind === 'deck' || entry.kind === 'summon')) {
    for (const text of content.payload.items as string[]) {
      const card = index.get(cardNameKey(text));
      expect(card, text).toBeDefined();
      expect(card?.image, text).toBeTruthy();
      count++;
    }
  }
  expect(count).toBe(674);
});

it('compilan las dos hojas nuevas sin colores externos a los tokens', () => {
  for (const component of ['AnimeCard', 'AnimeGameCards']) {
    const css = compile(path.join(import.meta.dirname, `${component}.module.scss`), { loadPaths: [path.join(root, 'src/styles')] }).css;
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css.length).toBeGreaterThan(0);
  }
});
