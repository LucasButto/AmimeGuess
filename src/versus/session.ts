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

/**
 * Contrarreloj y Carrera: sin límite de intentos (más la meta de Mayor o Menor y el objetivo de Estadísticas). Menos
 * intentos: los intentos de siempre (más los fallos perdonados de Mayor o Menor y las oportunidades fijas de Estadísticas: 3 por defecto, de 1 a 10).
 * El Quiz es la excepción: en las tres modalidades una opción incorrecta no termina la partida, queda marcada y se puede elegir
 * otra; cada opción elegida cuenta como un intento y la partida sigue hasta dar con la correcta (en Menos intentos, esos intentos
 * son los que se comparan).
 */
export function engineRulesFor(modality: Modality, engine: VersusEngine, options: VersusOptions): EngineRules {
  if (modality === 'fewestAttempts') {
    if (engine === 'quiz') return { unlimited: true };
    if (engine === 'higher-lower') return { forgivenErrors: options.higherLowerForgiven };
    // Estadísticas: las oportunidades que eligió el creador de la sala (3 por defecto).
    if (engine === 'stat-builder') return { fixedAttempts: options.statsAttempts };
    return {};
  }
  if (engine === 'higher-lower') return { unlimited: true, targetScore: options.higherLowerTarget };
  if (engine === 'stat-builder') return { unlimited: true, targetTotal: options.statsTarget };
  return { unlimited: true };
}
