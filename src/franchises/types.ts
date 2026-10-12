import type { ClassicConfig } from '../modes/classic/types';
import type { ConnectionsConfig } from '../modes/connections/types';
import type { HigherLowerConfig } from '../modes/higher-lower/types';
import type { ImageRevealConfig } from '../modes/image-reveal/types';
import type { RevealListConfig } from '../modes/reveal-list/types';
import type { TextClueConfig } from '../modes/text-clue/types';
import type { TimelineConfig } from '../modes/timeline/types';

/** Los 7 motores de juego (SPEC 3.2). Ninguno contiene lógica de una franquicia. */
export type EngineId =
  | 'classic'
  | 'image-reveal'
  | 'text-clue'
  | 'reveal-list'
  | 'higher-lower'
  | 'timeline'
  | 'connections';

export interface ModeConfig {
  /** Segmento de URL: /<franquicia>/<slug>. Estable, nunca se reutiliza. */
  readonly slug: string;
  readonly name: string;
  readonly engine: EngineId;
  /** Columnas y pistas, solo para los modos con motor `classic`. */
  readonly classic?: ClassicConfig;
  /** Variante e imagen, solo para los modos con motor `image-reveal`. */
  readonly imageReveal?: ImageRevealConfig;
  /** Contenido y pistas, solo para los modos con motor `text-clue`. */
  readonly textClue?: TextClueConfig;
  /** Lista de pistas, solo para los modos con motor `reveal-list`. */
  readonly revealList?: RevealListConfig;
  /** Métricas a comparar, solo para los modos con motor `higher-lower`. */
  readonly higherLower?: HigherLowerConfig;
  /** Sucesos a ordenar, solo para los modos con motor `timeline`. */
  readonly timeline?: TimelineConfig;
  /** Grupos a formar, solo para los modos con motor `connections`. */
  readonly connections?: ConnectionsConfig;
  /**
   * De dónde salen las entidades que se adivinan y se ofrecen como opción: el
   * conjunto con este nombre de `FranchiseData.entitySets` (por ejemplo, las
   * transformaciones de Dragon Ball). Sin esto, las entidades principales de la
   * franquicia (`FranchiseData.entities`).
   */
  readonly entitySet?: string;
}

/** Los colores que un tema define: los mismos que `$colors` en src/styles/_tokens.scss (un test lo comprueba). */
export const THEME_COLORS = [
  'bg',
  'surface',
  'stage',
  'text',
  'text-muted',
  'border',
  'accent',
  'accent-contrast',
  'focus',
  'match',
  'partial',
  'miss',
  'on-result',
] as const;
export type ThemeColor = (typeof THEME_COLORS)[number];

/** Fuentes de Google Fonts que cargan los temas (ver src/app/fonts.ts). Cada una es una variable CSS `--font-<id>`. */
export type ThemeFont = 'fredoka' | 'bangers' | 'kaushan-script' | 'cinzel';

/**
 * El tema de una franquicia (SPEC 9): paleta, tipografía de títulos, forma y tratamiento de fondo. Son solo
 * datos; `themeCss` los vuelve variables CSS y los estilos los leen con los tokens. La estructura de pantalla
 * es la misma en las cuatro.
 */
export interface FranchiseTheme {
  /** Si la paleta es clara u oscura: decide el `color-scheme` de los controles del navegador. */
  readonly scheme: 'light' | 'dark';
  readonly colors: Readonly<Record<ThemeColor, string>>;
  /** Fuente de los títulos y la pila de respaldo mientras carga. */
  readonly headingFont: { readonly id: ThemeFont; readonly fallback: string };
  /** Cuánto se redondean los bordes (rem): chico, mediano y grande. */
  readonly radius: { readonly sm: string; readonly md: string; readonly lg: string };
  /** Sombra o marco de las tarjetas, o `none`. Puede usar las variables `--color-*`. */
  readonly cardShadow: string;
  /** Cómo se escriben los títulos. */
  readonly headingStyle: { readonly letterSpacing: string; readonly textTransform: 'none' | 'uppercase' };
  /** Ilustración de fondo: un SVG de public/ (se escala sin pixelarse en 4K). Va fija detrás del contenido. */
  readonly background: string;
}

export interface FranchiseConfig {
  readonly slug: string;
  readonly name: string;
  /** IDs de serie en orden canónico (SPEC 3.1); con él se construye la clave de filtro. */
  readonly series: readonly string[];
  /** Nombre visible de cada serie, para los chips del panel de filtros. */
  readonly seriesLabels: Readonly<Record<string, string>>;
  /** Modos en el orden en que se muestran (SPEC 3.3). El primero es el principal. */
  readonly modes: readonly ModeConfig[];
  readonly theme: FranchiseTheme;
}
