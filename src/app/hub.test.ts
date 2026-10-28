import { readFileSync } from 'node:fs';
import path from 'node:path';
import { compile } from 'sass';
import { describe, expect, it } from 'vitest';
import { franchises } from '@/franchises';
import { contrastRatio, themeColor } from '@/franchises/theme';

const source = readFileSync(path.join(import.meta.dirname, 'page.module.scss'), 'utf8');
const colors = Object.fromEntries([...source.matchAll(/--(?:hub|tv)-([a-z-]+):\s*(#[0-9a-f]{6});/g)].map(([, name, hex]) => [name, hex]));

describe('contraste del televisor y de la sala (AA)', () => {
  it.each([
    ['ink', 'night'], ['ink', 'wall'], ['muted', 'night'], ['muted', 'wall'],
    ['focus', 'night'], ['focus', 'wall'],
    // Control remoto: el nombre del canal y su conteo (verde de pantalla) sobre las teclas.
    ['ink', 'key'], ['osd', 'key'], ['focus', 'key'], ['ink', 'key-light'], ['osd', 'key-light'],
    // El número de canal sobre su recuadro oscuro, dentro de la pantalla.
    ['osd', 'bezel'],
  ])('%s sobre %s pasa AA de texto', (ink, paper) => {
    expect(contrastRatio(colors[ink], colors[paper])).toBeGreaterThanOrEqual(4.5);
  });

  it('la chapa del título y la cruz del pie se leen', () => {
    // «ANIMEGUESS» (#23262b) sobre las tres paradas claras de la chapa; la cruz oscura sobre el dorado de su hover.
    for (const light of ['#e3e6eb', '#cfd3da', '#9aa0aa']) expect(contrastRatio('#23262b', light)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#23262b', colors.focus)).toBeGreaterThanOrEqual(4.5);
    // El pie: texto claro y enlace dorado sobre la chapa oscura, y la cruz dorada sobre su placa en reposo.
    expect(contrastRatio(colors.ink, '#1b1d22')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.focus, '#1b1d22')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.focus, '#2f323a')).toBeGreaterThanOrEqual(3);
  });

  it.each([
    ['pokemon', 'ink', 'cream'], ['dragon-ball', 'ink', 'cream'],
    ['naruto', 'ink', 'paper'], ['yugioh', 'gold', 'tomb'],
  ])('el conteo de %s se lee sobre su pantalla', (slug, ink, paper) => {
    const theme = franchises.find((franchise) => franchise.slug === slug)!.theme;
    expect(contrastRatio(themeColor(theme, ink)!, themeColor(theme, paper)!)).toBeGreaterThanOrEqual(4.5);
  });

  it('el foco se distingue de la carcasa, las teclas y la pared', () => {
    for (const background of ['slot', 'night', 'wall', 'case', 'case-light', 'key', 'body', 'bezel']) {
      expect(contrastRatio(colors.focus, colors[background]), background).toBeGreaterThanOrEqual(3);
    }
  });

  it('las hojas del hub compilan con los tokens y mixins existentes', () => {
    for (const file of ['page', 'TvRoom']) {
      expect(compile(path.join(import.meta.dirname, `${file}.module.scss`), {
        loadPaths: [path.resolve(import.meta.dirname, '../styles')],
      }).css.length).toBeGreaterThan(0);
    }
  });

  it('la estática y el parpadeo no pasan de 3 por segundo y solo animan transform y opacidad', () => {
    const tv = readFileSync(path.join(import.meta.dirname, 'TvRoom.module.scss'), 'utf8');
    // El parpadeo del tubo: un ciclo de 4 s. La estática: un corte de 640 ms y uno por vez (ver TvRoom.tsx).
    expect(tv).toMatch(/animation: tv-flicker 4s/);
    expect(tv).toMatch(/animation: tv-static 640ms/);
    for (const frames of tv.matchAll(/@keyframes [a-z-]+ \{([^@]*?)\}\s*(?=@|\n|$)/g)) {
      expect(frames[1]).not.toMatch(/\b(?:width|height|top|left|right|bottom|margin|padding|background|color)\s*:/);
    }
  });
});
