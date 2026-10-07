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
}

export interface FranchiseConfig {
  readonly slug: string;
  readonly name: string;
  /** IDs de serie en orden canónico (SPEC 3.1); con él se construye la clave de filtro. */
  readonly series: readonly string[];
  /** Modos en el orden en que se muestran (SPEC 3.3). */
  readonly modes: readonly ModeConfig[];
}
