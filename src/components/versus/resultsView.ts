import { samePartida, type Partida } from '@/versus/config';
import type { Results } from '@/versus/protocol';

// Cálculos de la pantalla de resultados, sin React.

/**
 * Los puntos que dio una partida en Menos intentos: N al 1.º, N − 1 al 2.º… 1 al último; los empatados se reparten los puntos
 * de sus puestos (de ahí los ,5). `ranking` son los grupos del primer puesto al último.
 */
export function pointsOf(ranking: readonly (readonly string[])[], players: number): Record<string, number> {
  const points: Record<string, number> = {};
  let position = 1;
  for (const group of ranking) {
    let sum = 0;
    for (let offset = 0; offset < group.length; offset += 1) sum += Math.max(1, players - (position + offset) + 1);
    for (const id of group) points[id] = sum / group.length;
    position += group.length;
  }
  return points;
}

/** El puesto (1.º, 2.º…) de cada jugador en una partida: los empatados comparten el de su grupo. */
export function placesOf(ranking: readonly (readonly string[])[]): Record<string, number> {
  const places: Record<string, number> = {};
  let position = 1;
  for (const group of ranking) {
    for (const id of group) places[id] = position;
    position += group.length;
  }
  return places;
}

/** Cuántas partidas de la sala resolvió cada jugador (las de desempate no cuentan). */
export function solvedCounts(results: Results): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const player of results.players) counts[player.id] = 0;
  for (const partida of results.partidas) {
    if (partida.tiebreak) continue;
    for (const game of partida.games) if (game.status === 'solved') counts[game.playerId] = (counts[game.playerId] ?? 0) + 1;
  }
  return counts;
}

/** Para cada partida, su lugar dentro de una repetición seguida del mismo modo ("1/3"): `null` si no se repite. */
export function repeatMarks(partidas: readonly Pick<Partida, 'franchise' | 'mode' | 'engine' | 'variant' | 'series' | 'toggles' | 'timeLimitMs'>[]): ({ readonly n: number; readonly of: number } | null)[] {
  const marks: ({ n: number; of: number } | null)[] = partidas.map(() => null);
  let start = 0;
  while (start < partidas.length) {
    let end = start + 1;
    while (end < partidas.length && samePartida(partidas[start] as Partida, partidas[end] as Partida)) end += 1;
    if (end - start > 1) for (let index = start; index < end; index += 1) marks[index] = { n: index - start + 1, of: end - start };
    start = end;
  }
  return marks;
}

/** Las filas de la tabla final con su apodo, para mostrar y compartir. */
export function tableLines(results: Results): { readonly playerId: string; readonly place: number; readonly name: string }[] {
  const names = new Map(results.players.map((player) => [player.id, player.name]));
  return results.table.map((row) => ({ playerId: row.playerId, place: row.place, name: names.get(row.playerId) ?? '?' }));
}
