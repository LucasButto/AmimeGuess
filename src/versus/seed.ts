import { fnv1a32 } from '../engine/hash';

// El "día" de cada partida de una sala (docs/versus/02-arquitectura.md, "Rango de días"). El reto sale del mismo
// mecanismo que el del día y el del modo infinito: (franquicia, modo, filtros, día) y el dataset. Cada partida usa un
// día propio, derivado de la semilla de la sala y de su índice, en un rango que no se cruza con los días reales (unos
// cientos) ni con los de práctica (1.000.000 a 1.001.000.000).

export const VERSUS_FROM = 2_000_000_000;
export const VERSUS_SPAN = 1_000_000_000;

export function isVersusDay(day: number): boolean {
  return Number.isInteger(day) && day >= VERSUS_FROM && day < VERSUS_FROM + VERSUS_SPAN;
}

/**
 * El día de la partida `index` (desde 1; las de desempate siguen la numeración: 11, 12…). Las partidas repetidas tienen
 * índices distintos y por eso retos distintos.
 */
export function versusDay(seed: string, index: number): number {
  return VERSUS_FROM + (fnv1a32(`${seed}|${index}`) % VERSUS_SPAN);
}
