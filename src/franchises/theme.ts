import { THEME_COLORS, type FranchiseTheme } from './types';

// Del tema de una franquicia (datos en su config.ts) a CSS y a las comprobaciones de contraste.
// Los estilos no conocen ninguna franquicia: leen las variables `--color-*`, `--radius-*`, etc. de
// src/styles/_tokens.scss, y acá se les da otro valor.

/** Selector que recibe las variables: `:root` para toda la página, o `[data-franchise="…"]` para una tarjeta. */
export type ThemeScope = ':root' | `[data-franchise="${string}"]`;

export function themeScope(slug: string): ThemeScope {
  return `[data-franchise="${slug}"]`;
}

/** Las variables CSS de un tema, listas para un `<style>`. Determinista: no depende de nada más que del tema. */
export function themeCss(theme: FranchiseTheme, scope: ThemeScope = ':root'): string {
  const lines = [
    ...THEME_COLORS.map((name) => `--color-${name}: ${theme.colors[name]};`),
    `--font-heading: var(--font-${theme.headingFont.id}), ${theme.headingFont.fallback};`,
    `--radius-sm: ${theme.radius.sm};`,
    `--radius-md: ${theme.radius.md};`,
    `--radius-lg: ${theme.radius.lg};`,
    `--card-shadow: ${theme.cardShadow};`,
    `--heading-letter-spacing: ${theme.headingStyle.letterSpacing};`,
    `--heading-text-transform: ${theme.headingStyle.textTransform};`,
    `--background-image: url('${theme.background}');`,
    `color-scheme: ${theme.scheme};`,
  ];
  return `${scope} { ${lines.join(' ')} }`;
}

// --- Contraste (WCAG 2.1) ---------------------------------------------------

function channel(value: number): number {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** Luminancia relativa de un color `#rrggbb`. */
export function luminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`Color inválido: ${hex}. Tiene que ser #rrggbb.`);
  const n = Number.parseInt(match[1], 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** Relación de contraste entre dos colores, de 1 a 21. AA pide 4,5 para texto y 3 para íconos y contornos de foco. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}
