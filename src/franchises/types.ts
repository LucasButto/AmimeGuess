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

export interface FranchiseConfig {
  readonly slug: string;
  readonly name: string;
  /** IDs de serie en orden canónico (SPEC 3.1); con él se construye la clave de filtro. */
  readonly series: readonly string[];
  /** Nombre visible de cada serie, para los chips del panel de filtros. */
  readonly seriesLabels: Readonly<Record<string, string>>;
  /** Modos en el orden en que se muestran (SPEC 3.3). */
  readonly modes: readonly ModeConfig[];
}
