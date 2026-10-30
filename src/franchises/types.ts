import type { ComponentType, ReactNode } from 'react';
import type { Entity } from '../engine/types';
import type { AutocompleteItem } from '../components/Autocomplete';
import type { PoolNoun } from '../components/FilterPanel';
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
  /** Límite base editable en data/mode.json; los filtros ajustan los modos de adivinar. */
  readonly try?: number;
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
export type ThemeFont = 'press-start-2p' | 'jersey-10' | 'rubik' | 'bangers' | 'permanent-marker' | 'shippori-mincho' | 'cinzel-decorative';

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
  /** Fuente del resto del texto, si el tema tiene una propia (sin esto, la del sistema). */
  readonly bodyFont?: { readonly id: ThemeFont; readonly fallback: string };
  /** Cuánto se redondean los bordes (rem): chico, mediano y grande. */
  readonly radius: { readonly sm: string; readonly md: string; readonly lg: string };
  /** Sombra o marco de las tarjetas, o `none`. Puede usar las variables `--color-*`. */
  readonly cardShadow: string;
  /** Cómo se escriben los títulos. */
  readonly headingStyle: { readonly letterSpacing: string; readonly textTransform: 'none' | 'uppercase' };
  /** Ilustración de fondo: un SVG de public/ (se escala sin pixelarse en 4K). Va fija detrás del contenido. */
  readonly background: string;
  /**
   * Colores propios de la piel de la franquicia (SPEC 9.2), además de los de `colors`: se publican como
   * variables `--palette-<nombre>` y la piel los usa desde su CSS. Viven acá para que el test de contraste
   * los cubra.
   */
  readonly palette?: Readonly<Record<string, string>>;
  /**
   * Los pares texto/fondo que usa la piel con esos colores (nombres de `palette` o de `colors`). Un test
   * les exige AA: 4,5:1 para texto normal y 3:1 para texto grande (`large`) y componentes de interfaz (`ui`).
   */
  readonly pairs?: ReadonlyArray<ThemePair>;
}

export interface ThemePair {
  readonly text: string;
  readonly background: string;
  readonly kind: 'text' | 'large' | 'ui';
  /** Dónde se usa, para el informe de contraste. */
  readonly where: string;
}

export interface FranchiseConfig {
  readonly slug: string;
  readonly name: string;
  /** IDs de serie en orden canónico (SPEC 3.1); con él se construye la clave de filtro. */
  readonly series: readonly string[];
  /** Nombre visible de cada serie, para los chips del panel de filtros. */
  readonly seriesLabels: Readonly<Record<string, string>>;
  /** Un dato más de cada serie que los chips muestran desde `sm` (por ejemplo, la región de una generación). */
  readonly seriesDetails?: Readonly<Record<string, string>>;
  /** Modos en el orden en que se muestran (SPEC 3.3). El primero es el principal. */
  readonly modes: readonly ModeConfig[];
  readonly theme: FranchiseTheme;
  /** Si las sugerencias del autocompletado muestran la miniatura de cada opción. Por defecto, sí. */
  readonly autocompleteThumbnails?: boolean;
  /** Cómo se llaman las entidades principales ("personaje"/"personajes"): el contador de posibles las nombra. */
  readonly entityNoun?: PoolNoun;
  /** Lo mismo para cada conjunto de entidades con nombre (`ModeConfig.entitySet`): "forma"/"formas", "carta"/"cartas". */
  readonly entitySetNouns?: Readonly<Record<string, PoolNoun>>;
}

// --- Piel (SPEC 9.2, sesiones 15 a 18) --------------------------------------
// Encima del tema base, cada franquicia puede tener una piel en src/franchises/<slug>/theme/: una clase
// que redefine los tokens semánticos (src/styles/_tokens.scss) y un conjunto de slots, componentes que
// reemplazan partes de la interfaz. Lo que una piel no define toma el valor por defecto (los componentes
// de la sesión 14), así una franquicia sin piel se sigue viendo con su tema base. El registro de pieles
// está en src/franchises/themes.ts.

/** Lo que recibe el slot `GuessInput`: dónde se elige el intento (un campo con sugerencias, un selector, etc.). */
export interface GuessInputProps {
  /** Nombre del campo ("Tu intento"). */
  readonly label: string;
  /** Solo lo que se puede elegir con las series activas, en el orden del catálogo (con `number` si lo tiene). */
  readonly items: readonly AutocompleteItem[];
  /** Ids que ya se probaron: no se pueden volver a elegir. */
  readonly excludeIds: ReadonlySet<string>;
  readonly onSelect: (id: string) => void;
  readonly disabled?: boolean;
}

/** Estado de hoy de un modo en la página de la franquicia; `unknown` mientras no se leyó el almacenamiento. */
export type ModeCardState = 'unknown' | 'pending' | 'solved';

export interface ModeCardProps {
  readonly slug: string;
  readonly name: string;
  readonly href: string;
  /** Posición en la lista; el 0 es el modo principal. */
  readonly index: number;
  readonly state: ModeCardState;
  /** Intentos de la partida ganada hoy, si se pudieron leer (no en los modos de puntaje). */
  readonly attempts?: number;
  /** Nombre accesible de la tarjeta: "Modo: estado". */
  readonly label: string;
}

/** Miniatura de un modo (2 rem) en la navegación entre modos de un juego. Decorativa. */
export interface ModeIconProps {
  readonly slug: string;
  /** Posición en la lista; el 0 es el modo principal. */
  readonly index: number;
  readonly current: boolean;
  readonly solved: boolean;
}

/** Lo que recibe el slot `TitleMark`: el modo cuyo título se está dibujando. */
export interface TitleMarkProps {
  readonly slug: string;
  /** Posición en la lista; el 0 es el modo principal. */
  readonly index: number;
}

export interface ModeFrameProps {
  readonly mode: string;
  readonly engine: EngineId;
  readonly children: ReactNode;
}

export interface CellBackProps {
  /** Índice de la columna de atributos, desde 0. */
  readonly index: number;
}

/** El dorso de una imagen que se da vuelta al aparecer (por ejemplo, el de una carta). */
export interface ImageBackProps {
  /** De qué es la imagen: el `imageContentKind` del modo (`tcg-card`…). */
  readonly kind: string;
}

export interface ChipMarkProps {
  readonly on: boolean;
  /** A qué opción corresponde (el id de la serie en los filtros), para que el tema dibuje una marca distinta en cada una. */
  readonly id?: string;
}

export interface BackNavIconProps {
  readonly kind: 'home' | 'franchise';
  /** `true` mientras corre la animación de salida, antes de navegar. */
  readonly leaving: boolean;
}

export interface StreakDisplayProps {
  readonly streak: number;
}

export interface AttemptsMeterProps {
  /** Intentos fallidos hasta ahora. */
  readonly failed: number;
  readonly won: boolean;
  /** Cuántos fallos admite el modo si los limita; los modos sin límite no lo pasan. */
  readonly total?: number;
}

export interface WinCelebrationProps {
  /**
   * Dónde se dibuja: `media`, encima de la imagen de la respuesta (por ejemplo, un destello); `details`,
   * debajo del resumen (por ejemplo, datos de la respuesta).
   */
  readonly part: 'media' | 'details';
  /** Nombre de la respuesta. */
  readonly label: string;
  /** Imagen de la respuesta, ver `ContentImage`. */
  readonly imageStem?: string;
  /** Atributos de la respuesta, para festejos que muestran datos (por ejemplo, sus estadísticas). */
  readonly attrs?: Readonly<Record<string, unknown>>;
}

export interface DailyRewardProps {
  readonly solved: number;
  readonly total: number;
  /** Los slugs de los modos terminados hoy, para un premio que depende de modos concretos. */
  readonly solvedSlugs: ReadonlySet<string>;
}

export interface ValueMarkProps {
  /** Clave de la columna del Clásico (`Entity.attrs`). */
  readonly column: string;
  /** El valor de la celda tal como se compara (sin unidad). */
  readonly value: string;
}

export interface MetricMarkProps {
  /** Clave del atributo que se compara en Mayor o Menor (`Entity.attrs`): el peso, la altura… */
  readonly metric: string;
}

/** Imagen alternativa de una opción; nunca decide el resultado ni modifica el botón. */
export interface ComparisonMediaProps {
  readonly entity: Entity;
  readonly metric: string;
  readonly revealed: boolean;
}

/** Contenido visual de un eslabón. El texto de posiciones ocultas no se entrega al slot. */
export interface RevealListItemProps {
  readonly position: number;
  readonly revealed: boolean;
  readonly text?: string;
}

/** Los componentes que una piel puede reemplazar (SPEC 9.2). */
export interface SkinSlots {
  readonly ComparisonMedia: ComponentType<ComparisonMediaProps>;
  readonly RevealListItem: ComponentType<RevealListItemProps>;
  /** Fondo de toda la franquicia: fijo detrás del contenido, decorativo. */
  readonly Backdrop: ComponentType;
  /** Dónde se elige el intento en los modos de adivinar (por defecto, un campo de texto con sugerencias). */
  readonly GuessInput: ComponentType<GuessInputProps>;
  readonly ModeCard: ComponentType<ModeCardProps>;
  /** Miniatura de cada modo en la navegación de los juegos (por defecto, ninguna). */
  readonly ModeIcon: ComponentType<ModeIconProps>;
  /** Una marca antes del título de la página de un modo, a la altura de las letras (por defecto, ninguna). */
  readonly TitleMark: ComponentType<TitleMarkProps>;
  readonly ModeFrame: ComponentType<ModeFrameProps>;
  readonly Footer: ComponentType;
  readonly CellBack: ComponentType<CellBackProps>;
  /** El dorso que se ve antes de que se dé vuelta una imagen de `SkinData.imageBack` (decorativo; llena el marco). */
  readonly ImageBack: ComponentType<ImageBackProps>;
  readonly ChipMark: ComponentType<ChipMarkProps>;
  /** El dibujo de un botón de volver; la caja y la posición son comunes (`BackNav`). */
  readonly BackNav: ComponentType<BackNavIconProps>;
  readonly PageTransition: ComponentType;
  /** Animación de salida al cambiar de pantalla (barras que se cierran, por ejemplo); `pageExitMs` es lo que dura. */
  readonly PageExit: ComponentType;
  readonly Loader: ComponentType;
  readonly StreakDisplay: ComponentType<StreakDisplayProps>;
  readonly AttemptsMeter: ComponentType<AttemptsMeterProps>;
  readonly WinCelebration: ComponentType<WinCelebrationProps>;
  readonly DailyReward: ComponentType<DailyRewardProps>;
  readonly ValueMark: ComponentType<ValueMarkProps>;
  /** Ícono al lado de la pregunta de Mayor o Menor, según lo que se compara (por defecto, ninguno). */
  readonly MetricMark: ComponentType<MetricMarkProps>;
}

/** Un efecto de sonido sintetizado (Web Audio, sin archivos): notas en orden, en hercios y milisegundos. */
export interface SoundRecipe {
  readonly wave: 'square' | 'triangle' | 'sine' | 'sawtooth';
  readonly notes: ReadonlyArray<{ readonly frequency: number; readonly duration: number }>;
  /** Volumen de 0 a 1. */
  readonly gain: number;
}

export type SoundName = 'reveal' | 'miss' | 'win';

export interface SkinData {
  /** Reemplaza solo la imagen de las opciones con ComparisonMedia; false por defecto. */
  readonly customComparisonMedia?: boolean;
  /** Reemplaza el contenido de cada posición con RevealListItem; false por defecto. */
  readonly customRevealListItems?: boolean;
  /** Motores adicionales que montan AttemptsMeter; no altera los montajes nativos. Vacío por defecto. */
  readonly additionalAttemptsMeters?: readonly EngineId[];
  /** Motores adicionales cuyo contenido se envuelve con ModeFrame. Vacío por defecto. */
  readonly additionalModeFrames?: readonly EngineId[];
  /** Prefijo visible de la posición de reveal-list; sin él se conserva solo el número. */
  readonly revealListPositionPrefix?: string;
  /** Permite WinCelebration en resúmenes por puntaje ganados. Desactivado por defecto. */
  readonly celebrateScoredResults?: boolean;
  /** Cómo se revela una celda del Clásico: girando desde su dorso o apareciendo debajo de él. */
  readonly revealMode: 'flip' | 'swap';
  /** Emojis del texto para compartir; los tres tienen que distinguirse entre sí. */
  readonly shareEmojis: { readonly correct: string; readonly partial: string; readonly incorrect: string };
  readonly sounds: Readonly<Partial<Record<SoundName, SoundRecipe>>>;
  /** Cuánto dura la animación de salida de los botones de volver antes de navegar (300 ms como máximo). */
  readonly backNavExitMs: number;
  /**
   * Cuánto dura la animación de salida (slot `PageExit`) al cambiar de modo antes de navegar (900 ms como máximo).
   * 0 es sin animación: se navega enseguida. Con movimiento reducido tampoco hay animación.
   */
  readonly pageExitMs: number;
  /** Íconos de las celdas del Clásico: los caracteres de siempre (✓ ≈ ✕ ↑ ↓) o los íconos pixel. */
  readonly cellIcons: 'text' | 'pixel';
  /**
   * Qué marcas llevan los resultados: `all` (✓, ≈, ✕ y flechas, como siempre), `hints` (solo el parcial y las flechas: el
   * verde y el rojo ya lo dicen con el color) o `arrows` (solo las flechas de mayor y menor: sin tildes, cruces ni el
   * símbolo del parcial en ningún modo; el verde, el amarillo o naranja y el rojo lo dicen solos). El texto para
   * lectores de pantalla siempre está.
   */
  readonly cellMarks: 'all' | 'hints' | 'arrows';
  /** Los chips de filtro miden todos lo mismo, en vez de ajustarse a su texto. */
  readonly uniformFilterChips: boolean;
  /**
   * Los `imageContentKind` de los modos de imagen cuya imagen aparece de espaldas y se da vuelta (slot `ImageBack`) al
   * quedar a la vista: por ejemplo, las cartas. Sin esto (`[]`), la imagen aparece directamente.
   */
  readonly imageBack: readonly string[];
  /** Título del resumen al ganar: el de siempre ("¡Lo adivinaste!") o la respuesta ("¡Es X!"). */
  readonly winHeadline: 'result' | 'answer';
}

/** Lo que define una piel: su clase raíz, sus datos y los slots que reemplaza. */
export interface FranchiseSkin extends Partial<SkinData> {
  /** Clase del CSS module de la piel que redefine los tokens semánticos. */
  readonly className: string;
  readonly slots?: Partial<SkinSlots>;
}

/** Una piel completa, con los valores por defecto donde la piel no define nada. */
export interface ResolvedSkin extends SkinData {
  readonly className: string | null;
  readonly slots: SkinSlots;
}
