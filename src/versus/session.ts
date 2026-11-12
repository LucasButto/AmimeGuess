import type { Modality, VersusEngine, VersusOptions } from './config';

// Qué reglas recibe el motor de una partida según la modalidad (docs/versus/02-arquitectura.md, "Contrato con los
// motores"). Es el mismo bloque que `GameSession.versus`, sin el pedido de cierre (`stop`), que llega aparte.

export interface EngineRules {
  readonly unlimited?: boolean;
  readonly forgivenErrors?: number;
  readonly targetScore?: number;
  readonly fixedAttempts?: number;
  readonly targetTotal?: number;
}

/** Combinaciones fijas de Estadísticas en Menos intentos. */
export const STATS_FIXED_ATTEMPTS = 3;

/**
 * Contrarreloj y Carrera: sin límite de intentos (más la meta de Mayor o Menor y el objetivo de Estadísticas). Menos
 * intentos: los intentos de siempre (más los fallos perdonados de Mayor o Menor y 3 combinaciones fijas en Estadísticas).
 */
export function engineRulesFor(modality: Modality, engine: VersusEngine, options: VersusOptions): EngineRules {
  if (modality === 'fewestAttempts') {
    if (engine === 'higher-lower') return { forgivenErrors: options.higherLowerForgiven };
    if (engine === 'stat-builder') return { fixedAttempts: STATS_FIXED_ATTEMPTS };
    return {};
  }
  if (engine === 'higher-lower') return { unlimited: true, targetScore: options.higherLowerTarget };
  if (engine === 'stat-builder') return { unlimited: true, targetTotal: options.statsTarget };
  return { unlimited: true };
}
