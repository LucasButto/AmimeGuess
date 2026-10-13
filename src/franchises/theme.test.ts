import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { franchises } from './index';
import { AA_MINIMUM, contrastRatio, themeColor, themeCss, themeScope } from './theme';
import { THEME_COLORS } from './types';

// Contraste AA (WCAG 2.1) en los cuatro temas: 4,5 para texto, 3 para íconos y contornos de foco.
const AA_TEXT = 4.5;
const AA_UI = 3;

const ROOT = path.resolve(import.meta.dirname, '..', '..');

describe('los colores de un tema son los de los tokens', () => {
  it('THEME_COLORS lista exactamente los colores de $colors en _tokens.scss', () => {
    const scss = readFileSync(path.join(ROOT, 'src', 'styles', '_tokens.scss'), 'utf8');
    const start = scss.indexOf('$colors: (');
    const block = scss.slice(start, scss.indexOf(');', start));
    const names = [...block.matchAll(/^\s*'([a-z-]+)':/gm)].map((match) => match[1]);
    expect([...THEME_COLORS].sort()).toEqual(names.sort());
  });
});

describe.each(franchises.map((franchise) => [franchise.slug, franchise.theme] as const))('tema de %s', (_slug, theme) => {
  const { colors } = theme;
  const ratio = (a: keyof typeof colors, b: keyof typeof colors) => contrastRatio(colors[a], colors[b]);

  it('define todos los colores como #rrggbb', () => {
    for (const name of THEME_COLORS) expect(colors[name], name).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('el texto y el texto atenuado se leen sobre el fondo y sobre las tarjetas (AA, 4,5:1)', () => {
    for (const background of ['bg', 'surface'] as const) {
      expect(ratio('text', background), `text/${background}`).toBeGreaterThanOrEqual(AA_TEXT);
      expect(ratio('text-muted', background), `text-muted/${background}`).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it('el acento se lee como texto (links) sobre el fondo y las tarjetas, y el texto sobre el acento también', () => {
    for (const background of ['bg', 'surface'] as const) {
      expect(ratio('accent', background), `accent/${background}`).toBeGreaterThanOrEqual(AA_TEXT);
    }
    expect(ratio('accent-contrast', 'accent')).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('el texto de las celdas de resultado se lee sobre acierto, parcial y error', () => {
    for (const result of ['match', 'partial', 'miss'] as const) {
      expect(ratio('on-result', result), `on-result/${result}`).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it('el tilde de "resuelto" (color de acierto) se lee sobre las tarjetas, y las celdas se distinguen de ellas', () => {
    expect(ratio('match', 'surface')).toBeGreaterThanOrEqual(AA_TEXT);
    for (const result of ['match', 'partial', 'miss'] as const) {
      expect(ratio(result, 'surface'), `${result}/surface`).toBeGreaterThanOrEqual(AA_UI);
    }
  });

  it('el contorno de foco se ve sobre el fondo y sobre las tarjetas (3:1)', () => {
    for (const background of ['bg', 'surface'] as const) {
      expect(ratio('focus', background), `focus/${background}`).toBeGreaterThanOrEqual(AA_UI);
    }
  });

  it('la silueta (negra) se ve sobre el escenario de las imágenes, también en los temas oscuros', () => {
    expect(contrastRatio('#000000', colors.stage)).toBeGreaterThanOrEqual(12);
  });

  it('el borde de las tarjetas se distingue del fondo', () => {
    expect(ratio('border', 'surface')).toBeGreaterThanOrEqual(1.5);
  });

  it('acierto, parcial y error son tres colores distintos', () => {
    expect(new Set([colors.match, colors.partial, colors.miss]).size).toBe(3);
  });
});

describe.each(franchises.map((franchise) => [franchise.slug, franchise.theme] as const))('paleta de la piel de %s', (_slug, theme) => {
  it('define cada color de la paleta como #rrggbb, con 24 colores como mucho contando los del tema', () => {
    const palette = Object.values(theme.palette ?? {});
    for (const value of palette) expect(value).toMatch(/^#[0-9a-f]{6}$/i);
    if (palette.length > 0) expect(new Set([...palette, ...Object.values(theme.colors)]).size).toBeLessThanOrEqual(24);
  });

  it('cada par texto/fondo que usa la piel pasa AA (4,5:1 texto; 3:1 texto grande e interfaz)', () => {
    for (const pair of theme.pairs ?? []) {
      const text = themeColor(theme, pair.text);
      const background = themeColor(theme, pair.background);
      expect(text, pair.text).toBeDefined();
      expect(background, pair.background).toBeDefined();
      expect(contrastRatio(text!, background!), `${pair.text}/${pair.background} (${pair.where})`).toBeGreaterThanOrEqual(
        AA_MINIMUM[pair.kind],
      );
    }
  });

  it('las variables de la paleta llegan al CSS', () => {
    for (const [name, value] of Object.entries(theme.palette ?? {})) expect(themeCss(theme)).toContain(`--palette-${name}: ${value};`);
  });
});

describe('themeCss', () => {
  const pokemon = franchises[0].theme;

  it('emite una variable por color y las de forma, fuente y fondo, en el alcance pedido', () => {
    const css = themeCss(pokemon);
    expect(css.startsWith(':root { ')).toBe(true);
    for (const name of THEME_COLORS) expect(css).toContain(`--color-${name}: ${pokemon.colors[name]};`);
    expect(css).toContain('--font-heading: var(--font-press-start-2p),');
    expect(css).toContain('--font-body: var(--font-jersey-10),');
    expect(css).toContain(`--radius-lg: ${pokemon.radius.lg};`);
    expect(css).toContain("--background-image: url('/themes/pokemon.svg');");
    expect(css).toContain('color-scheme: light;');
    expect(themeCss(pokemon, themeScope('pokemon')).startsWith('[data-franchise="pokemon"] { ')).toBe(true);
  });

  it('es determinista', () => {
    expect(themeCss(pokemon)).toBe(themeCss(pokemon));
  });

  it('Pokémon y Naruto son claros; Dragon Ball y Yu-Gi-Oh, oscuros, y el CSS lo declara', () => {
    expect(franchises.map((franchise) => franchise.theme.scheme)).toEqual(['light', 'dark', 'light', 'dark']);
    for (const franchise of franchises) {
      expect(themeCss(franchise.theme)).toContain(`color-scheme: ${franchise.theme.scheme};`);
    }
  });
});

describe('fondos', () => {
  it('cada tema apunta a un SVG que existe en public/', () => {
    for (const franchise of franchises) {
      expect(franchise.theme.background, franchise.slug).toMatch(/^\/themes\/[a-z-]+\.svg$/);
      const file = path.join(ROOT, 'public', franchise.theme.background);
      expect(() => readFileSync(file), franchise.slug).not.toThrow();
    }
  });
});
