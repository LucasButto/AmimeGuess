import { samePartida, type Modality, type Partida, type StatsAggregation, type VersusEngine, type VersusOptions } from './config';

// Las reglas de puntaje del versus (docs/versus/01-reglas.md, secciones 3 a 8). Funciones puras sobre resultados ya
// medidos: los tiempos los pone el servidor y el azar entra como dato. Si una regla cambia, se cambia primero en
// 01-reglas.md y después acá y en rules.test.ts.

/**
 * Cómo terminó la partida de un jugador:
 * - `solved`: la resolvió. En Menos intentos, Mayor o Menor y Estadísticas también es "la terminó por sus reglas"
 *   (agotó los fallos perdonados, fin anticipado, hizo sus 3 combinaciones).
 * - `failed`: se quedó sin intentos (Menos intentos). En Mayor o Menor y Estadísticas cuenta igual que `solved`: no hay
 *   derrota, vale el puntaje.
 * - `surrendered`: se rindió. `timeUp`: se le acabó el tiempo (Contrarreloj). `abandoned`: abandonó la sala.
 */
export type PartidaStatus = 'solved' | 'failed' | 'surrendered' | 'timeUp' | 'abandoned';

export interface PartidaResult {
  readonly playerId: string;
  readonly status: PartidaStatus;
  /** Lo que tardó en esta partida, desde que el servidor la marcó empezada para él (Contrarreloj y Carrera). */
  readonly elapsedMs?: number;
  /** Cuándo el servidor recibió el final, en ms desde la hora de inicio común (Carrera). */
  readonly finishedAtMs?: number;
  /** Intentos que cuenta el modo (Menos intentos). */
  readonly attempts?: number;
  /** Mayor o Menor: aciertos. */
  readonly score?: number;
  /** Estadísticas: el total de cada combinación. */
  readonly scores?: readonly number[];
}

/** Una partida jugada: su motor, su tiempo límite (Contrarreloj) y el resultado de cada jugador que la terminó. */
export interface PlayedPartida {
  readonly engine: VersusEngine;
  readonly timeLimitMs?: number;
  readonly results: readonly PartidaResult[];
}

export interface VersusPlayer {
  readonly id: string;
  /** Si abandonó la sala (se desconectó más de 2 minutos o tocó Salir). */
  readonly abandoned?: boolean;
}

/** Un orden con empates: grupos de jugadores, del primer puesto al último. Los de un mismo grupo comparten el puesto. */
export type Ranking = readonly (readonly string[])[];

/** Las opciones de la sala que usan las reglas. */
export type RuleOptions = Pick<VersusOptions, 'statsAggregation'>;

const LOST: ReadonlySet<PartidaStatus> = new Set(['surrendered', 'timeUp', 'abandoned']);

// --- Contrarreloj -----------------------------------------------------------------------------------------------------

/** El tiempo que suma una partida en Contrarreloj: lo que tardó si la resolvió; si no, el límite completo. */
export function countedTime(result: PartidaResult | undefined, timeLimitMs: number): number {
  if (result?.status !== 'solved' || result.elapsedMs === undefined) return timeLimitMs;
  return Math.min(Math.max(0, result.elapsedMs), timeLimitMs);
}

// --- Estadísticas -----------------------------------------------------------------------------------------------------

export interface StatsScore {
  /** Lo que se muestra: el mejor total, la suma, o el promedio con un decimal. */
  readonly value: number;
  /** Con qué se ordena: igual que `value`, salvo en el promedio, que ordena por la suma. */
  readonly rank: number;
}

/** El puntaje de las combinaciones de Estadísticas según la opción de la sala. */
export function statsScore(totals: readonly number[], aggregation: StatsAggregation): StatsScore {
  const sum = totals.reduce((acc, total) => acc + total, 0);
  if (aggregation === 'best') {
    const best = totals.length === 0 ? 0 : Math.max(...totals);
    return { value: best, rank: best };
  }
  if (aggregation === 'sum') return { value: sum, rank: sum };
  return { value: Math.round((sum / 3) * 10) / 10, rank: sum };
}

// --- Orden de una partida ---------------------------------------------------------------------------------------------

/** Ordena de mayor a menor (`desc`) o de menor a mayor, y agrupa los que tienen el mismo valor. */
function groupBy(entries: readonly { readonly id: string; readonly key: number }[], order: 'asc' | 'desc'): string[][] {
  const sorted = [...entries].sort((a, b) => (order === 'asc' ? a.key - b.key : b.key - a.key) || a.id.localeCompare(b.id));
  const groups: string[][] = [];
  let lastKey: number | undefined;
  for (const entry of sorted) {
    if (groups.length > 0 && entry.key === lastKey) groups[groups.length - 1].push(entry.id);
    else groups.push([entry.id]);
    lastKey = entry.key;
  }
  return groups;
}

/** Junta los rankeados con el grupo de los que perdieron, que empatan entre ellos detrás de todos. */
function withLosers(ranked: string[][], losers: readonly string[]): string[][] {
  return losers.length > 0 ? [...ranked, [...losers].sort()] : ranked;
}

/**
 * Los puestos de una partida, con empates. `players` son todos los de la sala: el que no tiene resultado (no llegó o
 * abandonó) cuenta como abandono.
 *
 * - Contrarreloj: menor tiempo contado primero (`countedTime`); a igual tiempo, empatan.
 * - Carrera: los que la resolvieron, de menor a mayor tiempo; los demás, detrás y empatados.
 * - Menos intentos (el tiempo no desempata): en los modos de adivinar, Línea de tiempo y Conexiones, los que la
 *   resolvieron de menos a más intentos; en Mayor o Menor, más aciertos primero; en Estadísticas, mayor puntaje
 *   primero. Quien pierde (sin intentos, rendido o abandono; en Mayor o Menor y Estadísticas, rendido o abandono) queda
 *   detrás de todos, empatado con los otros que perdieron.
 */
export function rankPartida(
  modality: Modality,
  partida: PlayedPartida,
  players: readonly string[],
  options: RuleOptions,
): Ranking {
  const resultOf = (id: string): PartidaResult => partida.results.find((result) => result.playerId === id) ?? { playerId: id, status: 'abandoned' };
  const results = players.map(resultOf);

  if (modality === 'timeAttack') {
    const limit = partida.timeLimitMs ?? 0;
    return groupBy(results.map((result) => ({ id: result.playerId, key: countedTime(result, limit) })), 'asc');
  }

  if (modality === 'race') {
    const solved = results.filter((result) => result.status === 'solved');
    const losers = results.filter((result) => result.status !== 'solved').map((result) => result.playerId);
    return withLosers(groupBy(solved.map((result) => ({ id: result.playerId, key: result.elapsedMs ?? Number.MAX_SAFE_INTEGER })), 'asc'), losers);
  }

  if (partida.engine === 'higher-lower' || partida.engine === 'stat-builder') {
    const scored = results.filter((result) => !LOST.has(result.status));
    const losers = results.filter((result) => LOST.has(result.status)).map((result) => result.playerId);
    const key = (result: PartidaResult) =>
      partida.engine === 'higher-lower' ? (result.score ?? 0) : statsScore(result.scores ?? [], options.statsAggregation).rank;
    return withLosers(groupBy(scored.map((result) => ({ id: result.playerId, key: key(result) })), 'desc'), losers);
  }

  const solved = results.filter((result) => result.status === 'solved');
  const losers = results.filter((result) => result.status !== 'solved').map((result) => result.playerId);
  return withLosers(groupBy(solved.map((result) => ({ id: result.playerId, key: result.attempts ?? Number.MAX_SAFE_INTEGER })), 'asc'), losers);
}

// --- Mayor o Menor: fin anticipado ------------------------------------------------------------------------------------

export interface LiveScore {
  readonly playerId: string;
  /** Si ya terminó su partida (agotó los fallos, se rindió o abandonó). */
  readonly finished: boolean;
  readonly score: number;
}

/**
 * Menos intentos, Mayor o Menor: si la partida de `playerId` termina sola, como ganada, porque todos los demás ya la
 * terminaron y él tiene más aciertos que todos ellos.
 */
export function higherLowerEarlyEnd(scores: readonly LiveScore[], playerId: string): boolean {
  const self = scores.find((entry) => entry.playerId === playerId);
  const others = scores.filter((entry) => entry.playerId !== playerId);
  if (!self || self.finished || others.length === 0) return false;
  return others.every((entry) => entry.finished) && others.every((entry) => self.score > entry.score);
}

// --- Puntos por posición ----------------------------------------------------------------------------------------------

/**
 * Puntos por posición de una partida (Menos intentos), en **medios puntos** para no arrastrar decimales: con N
 * jugadores, el 1.º recibe N puntos (2N medios), el último 1 (2 medios), y los empatados se reparten en partes iguales
 * la suma de las posiciones que ocupan. Siempre da un entero o ,5; la suma de la partida es N × (N + 1) / 2.
 */
export function positionPoints(ranking: Ranking): Map<string, number> {
  const n = ranking.reduce((acc, group) => acc + group.length, 0);
  const halves = new Map<string, number>();
  let position = 1;
  for (const group of ranking) {
    const first = n - position + 1;
    const last = n - (position + group.length - 1) + 1;
    // Promedio de las posiciones first…last, por 2: (first + last) es siempre entero.
    for (const id of group) halves.set(id, first + last);
    position += group.length;
  }
  return halves;
}

/** Medios puntos a puntos para mostrar (5 → 2,5). */
export function halvesToPoints(halves: number): number {
  return halves / 2;
}

// --- Tabla final ------------------------------------------------------------------------------------------------------

export interface TableRow {
  readonly playerId: string;
  /** Puesto, desde 1; los empatados comparten el mismo (1, 1, 3). */
  readonly place: number;
  /** Contrarreloj: tiempo total contado, en ms. */
  readonly totalMs?: number;
  /** Carrera: llegada en ms desde el inicio común; sin llegar, no tiene. */
  readonly arrivalMs?: number;
  /** Menos intentos: medios puntos. */
  readonly halfPoints?: number;
}

/** Arma las filas de un orden con su puesto compartido. */
function rowsOf(ranking: Ranking, extra: (id: string) => Omit<TableRow, 'playerId' | 'place'>): TableRow[] {
  const rows: TableRow[] = [];
  let place = 1;
  for (const group of ranking) {
    for (const id of group) rows.push({ playerId: id, place, ...extra(id) });
    place += group.length;
  }
  return rows;
}

/** Si queda un solo jugador sin abandonar (con 2 o más en la sala), ese gana: pasa al primer puesto, solo. */
function singleActiveFirst(ranking: Ranking, players: readonly VersusPlayer[]): Ranking {
  const active = players.filter((player) => !player.abandoned);
  if (players.length < 2 || active.length !== 1) return ranking;
  const winner = active[0].id;
  const rest = ranking.map((group) => group.filter((id) => id !== winner)).filter((group) => group.length > 0);
  return [[winner], ...rest];
}

/**
 * La tabla final de las partidas de la sala (sin las de desempate):
 * - Contrarreloj: menor tiempo total (lo que falta por abandono suma el límite completo).
 * - Carrera: orden de llegada al terminar la última; los que no llegaron, últimos y empatados.
 * - Menos intentos: más puntos por posición.
 * Con un solo jugador activo y los demás abandonados, ese jugador gana.
 */
export function finalTable(modality: Modality, players: readonly VersusPlayer[], partidas: readonly PlayedPartida[], options: RuleOptions): TableRow[] {
  const ids = players.map((player) => player.id);

  if (modality === 'timeAttack') {
    const totals = new Map(ids.map((id) => [id, 0]));
    for (const partida of partidas) {
      for (const id of ids) totals.set(id, totals.get(id)! + countedTime(partida.results.find((result) => result.playerId === id), partida.timeLimitMs ?? 0));
    }
    const ranking = singleActiveFirst(groupBy(ids.map((id) => ({ id, key: totals.get(id)! })), 'asc'), players);
    return rowsOf(ranking, (id) => ({ totalMs: totals.get(id)! }));
  }

  if (modality === 'race') {
    const arrival = new Map<string, number>();
    for (const id of ids) {
      const all = partidas.map((partida) => partida.results.find((result) => result.playerId === id));
      const last = all[all.length - 1];
      if (all.length > 0 && all.every((result) => result?.status === 'solved') && last?.finishedAtMs !== undefined) arrival.set(id, last.finishedAtMs);
    }
    const arrived = ids.filter((id) => arrival.has(id));
    const ranking = singleActiveFirst(withLosers(groupBy(arrived.map((id) => ({ id, key: arrival.get(id)! })), 'asc'), ids.filter((id) => !arrival.has(id))), players);
    return rowsOf(ranking, (id) => (arrival.has(id) ? { arrivalMs: arrival.get(id)! } : {}));
  }

  const halves = new Map(ids.map((id) => [id, 0]));
  for (const partida of partidas) {
    for (const [id, value] of positionPoints(rankPartida(modality, partida, ids, options))) halves.set(id, halves.get(id)! + value);
  }
  const ranking = singleActiveFirst(groupBy(ids.map((id) => ({ id, key: halves.get(id)! })), 'desc'), players);
  return rowsOf(ranking, (id) => ({ halfPoints: halves.get(id)! }));
}

/** Los empatados en el primer puesto (vacío si hay un solo primero). Los empates en otros puestos no desempatan. */
export function tiedForFirst(table: readonly TableRow[]): string[] {
  const first = table.filter((row) => row.place === 1).map((row) => row.playerId);
  return first.length > 1 ? first : [];
}

/**
 * La tabla después de una partida de desempate: los empatados en el primer puesto quedan en el orden de `tiebreak` (el
 * ganador 1.º y los demás a continuación). Si en el desempate vuelven a empatar arriba, siguen compartiendo el 1.º y
 * `tiedForFirst` los vuelve a encontrar para otra votación. El resto de la tabla no cambia.
 */
export function applyTiebreak(table: readonly TableRow[], tiebreak: Ranking): TableRow[] {
  const tied = new Set(tiedForFirst(table));
  if (tied.size === 0) return [...table];
  const order = tiebreak.map((group) => group.filter((id) => tied.has(id))).filter((group) => group.length > 0);
  // Quien no aparece en el desempate (abandonó antes de jugarlo) lo pierde.
  const missing = [...tied].filter((id) => !order.some((group) => group.includes(id)));
  if (missing.length > 0) order.push(missing.sort());
  const byId = new Map(table.map((row) => [row.playerId, row]));
  const rows: TableRow[] = [];
  let place = 1;
  for (const group of order) {
    for (const id of group) rows.push({ ...byId.get(id)!, place });
    place += group.length;
  }
  return [...rows, ...table.filter((row) => !tied.has(row.playerId))];
}

// --- Desempate: votación y ruleta -------------------------------------------------------------------------------------

/** Lo que vota un empatado: un modo jugado (por su índice en la sala, desde 1) u otro modo. */
export type TiebreakVote = { readonly played: number } | { readonly other: Partida };

/** Una partida jugada, con su índice, para el menú de la votación. */
export interface PlayedOption {
  readonly index: number;
  readonly partida: Partida;
}

export interface RouletteSlice {
  readonly option: TiebreakVote;
  /** Cuántos votos tiene: la porción de la ruleta es proporcional. */
  readonly votes: number;
}

export interface TiebreakOutcome {
  /** Las opciones de la ruleta, en orden, con sus votos. Con una sola, no hace falta girarla. */
  readonly slices: readonly RouletteSlice[];
  /** El índice de la porción que salió. */
  readonly winner: number;
  /** La partida que se juega (sin el tiempo límite: el desempate usa el de su tipo de modo). */
  readonly partida: Partida;
}

/** Lo que identifica a un modo para la votación: franquicia, modo, variante, filtros e interruptores (no el tiempo). */
function sameMode(a: Partida, b: Partida): boolean {
  return samePartida(untimed(a), untimed(b));
}

/** La partida sin su tiempo límite. */
function untimed(partida: Partida): Partida {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { timeLimitMs, timeEdited, ...rest } = partida;
  return rest;
}

/**
 * El resultado de la votación de desempate. `votes` son los votos emitidos (los que no votaron no cuentan); `played`, las
 * partidas jugadas; `random`, un número en [0, 1) que pone el servidor.
 * - Todos votaron lo mismo: esa opción, sin sorteo.
 * - Varias opciones: sorteo ponderado por los votos (cada voto es una porción igual).
 * - Nadie votó: sorteo entre los modos jugados, una porción cada uno.
 * Un modo jugado repetido (×3) es una sola opción, y un "otro modo" igual a uno jugado cuenta como ese.
 */
export function tiebreakOutcome(votes: readonly TiebreakVote[], played: readonly PlayedOption[], random: number): TiebreakOutcome {
  // Los modos jugados sin repetir: la primera aparición representa a las demás.
  const distinct: PlayedOption[] = [];
  for (const option of played) if (!distinct.some((seen) => sameMode(seen.partida, option.partida))) distinct.push(option);
  const canonical = (vote: TiebreakVote): TiebreakVote => {
    const partida = 'played' in vote ? played.find((option) => option.index === vote.played)?.partida : vote.other;
    const match = partida && distinct.find((option) => sameMode(option.partida, partida));
    return match ? { played: match.index } : vote;
  };
  const partidaOf = (vote: TiebreakVote): Partida => {
    const partida = 'played' in vote ? distinct.find((option) => option.index === vote.played)?.partida : vote.other;
    if (!partida) throw new Error('voto por una partida que no se jugó');
    return untimed(partida);
  };

  const valid = votes.map(canonical).filter((vote) => !('played' in vote) || distinct.some((option) => option.index === vote.played));
  const slices: { option: TiebreakVote; votes: number }[] = [];
  if (valid.length === 0) {
    for (const option of distinct) slices.push({ option: { played: option.index }, votes: 1 });
  } else {
    for (const vote of valid) {
      const existing = slices.find((slice) => sameMode(partidaOf(slice.option), partidaOf(vote)));
      if (existing) existing.votes += 1;
      else slices.push({ option: vote, votes: 1 });
    }
    // Orden de la ruleta: primero los jugados (por índice), después los otros (en el orden en que se votaron).
    const order = (slice: RouletteSlice) => ('played' in slice.option ? slice.option.played : Number.MAX_SAFE_INTEGER);
    slices.sort((a, b) => order(a) - order(b));
  }
  if (slices.length === 0) throw new Error('el desempate necesita al menos un modo jugado');

  const total = slices.reduce((acc, slice) => acc + slice.votes, 0);
  let ticket = Math.min(total - 1, Math.floor(Math.min(Math.max(random, 0), 0.999999999999) * total));
  let winner = 0;
  for (; winner < slices.length; winner++) {
    if (ticket < slices[winner].votes) break;
    ticket -= slices[winner].votes;
  }
  return { slices, winner, partida: partidaOf(slices[winner].option) };
}
