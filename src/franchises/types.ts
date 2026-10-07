import type { ClassicConfig } from '../modes/classic/types';

/** Los 8 motores de juego (SPEC 3.2). Ninguno contiene lógica de una franquicia. */
export type EngineId =
  | 'classic'
  | 'image-reveal'
  | 'text-clue'
  | 'audio-clue'
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
