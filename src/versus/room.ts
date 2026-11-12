import { fnv1a32 } from '../engine/hash';
import { LIMITS, defaultTimeLimit, isValidName, type Partida, type VersusConfig } from './config';
import {
  PROTOCOL_VERSION,
  type Answer,
  type ClientMessage,
  type ErrorCode,
  type PlayerView,
  type ProgressView,
  type Results,
  type ServerMessage,
  type Snapshot,
  type SpinView,
  type TiebreakView,
} from './protocol';
import {
  applyTiebreak,
  distinctModes,
  finalTable,
  higherLowerEarlyEnd,
  rankPartida,
  tiebreakOutcome,
  tiedForFirst,
  type PartidaResult,
  type PartidaStatus,
  type PlayedOption,
  type PlayedPartida,
  type TableRow,
  type TiebreakOutcome,
  type TiebreakVote,
} from './rules';

// El reductor de la sala (docs/versus/02-arquitectura.md, "VersusRoom"): toda la lógica del servidor en una función pura,
// `reduce(state, event, now) → { state, send, alarms, … }`. El Durable Object solo guarda el estado, lee el reloj, programa
// la alarma más cercana y reparte los mensajes; así se prueba entero sin Cloudflare. Nada de `Date.now()` ni de azar acá
// adentro: la hora llega en `now` y el azar en `event.entropy` (texto hexadecimal al azar que pone el objeto).

// --- Constantes (01-reglas.md) -----------------------------------------------------------------------------------------

export const COUNTDOWN_MS = 3_000;
/** Lo que tiene un jugador para volver a su lugar después de desconectarse. */
export const RECONNECT_MS = 120_000;
export const VOTE_MS = 30_000;
/** Lo que dura la ruleta del desempate. */
export const SPIN_MS = 4_000;
/** Una sala de espera sin actividad se borra. */
export const LOBBY_IDLE_MS = 3_600_000;
/** Una sala terminada se puede ver 24 horas. */
export const FINISHED_TTL_MS = 86_400_000;
/** Lo que se espera el aviso `loaded` de una partida antes de empezarla igual (para que nadie frene la sala). */
export const LOAD_GRACE_MS = 30_000;
export const MAX_SPECTATORS = 8;
/** El índice de la primera partida de desempate: así su reto nunca coincide con uno jugado. */
export const TIEBREAK_FIRST_INDEX = 11;
/** Cuánto azar hace falta en `entropy`: id (8), token (32), semilla (16) y el resto para sorteos. */
export const MIN_ENTROPY = 56;

// --- Estado ------------------------------------------------------------------------------------------------------------

export type Phase = 'lobby' | 'countdown' | 'playing' | 'tiebreakVote' | 'tiebreakSpin' | 'tiebreakPlaying' | 'finished';
export type GameStatus = 'pending' | 'playing' | PartidaStatus;

/** La partida de un jugador. */
export interface GameRecord {
  index: number;
  status: GameStatus;
  /** Desde cuándo espera el aviso `loaded`. */
  pendingSince?: number;
  startedAt?: number;
  /** Contrarreloj: cuándo se le acaba el tiempo. */
  endsAt?: number;
  attempts: number;
  errors?: number;
  score?: number;
  scores?: number[];
  elapsedMs?: number;
  /** Desde el inicio común de la sala, en ms. */
  finishedAtMs?: number;
  grid?: string[];
  answer?: Answer;
  endNowSent?: boolean;
}

export interface RoomPlayer {
  id: string;
  token: string;
  name: string;
  ready: boolean;
  joinedAt: number;
  disconnectedAt?: number;
  abandoned: boolean;
  /** La partida en la que va (null: no tiene ninguna para jugar ahora). */
  current: number | null;
  games: GameRecord[];
}

export interface VoteState {
  round: number;
  tied: string[];
  votes: Record<string, TiebreakVote>;
  endsAt: number;
}

export interface SpinState {
  endsAt: number;
  outcome: TiebreakOutcome;
  participants: string[];
}

export interface ExtraGame {
  index: number;
  partida: Partida;
  participants: string[];
}

export interface RoomState {
  code: string;
  seed: string;
  config: VersusConfig;
  phase: Phase;
  createdAt: number;
  lastActivityAt: number;
  /** Cuenta regresiva: la hora de inicio común. */
  startsAt?: number;
  finishedAt?: number;
  hostId: string;
  players: RoomPlayer[];
  /** Cada conexión abierta y su jugador (`null`: espectador o todavía sin presentarse). */
  conns: Record<string, string | null>;
  extra: ExtraGame[];
  /** La tabla del momento: la de las partidas de la sala y, después de cada desempate, con su resultado. */
  table?: TableRow[];
  /** Cuántas votaciones de desempate hubo. */
  round: number;
  tiebreakWon: boolean;
  vote?: VoteState;
  spin?: SpinState;
  /** El código de la sala de la revancha, si el creador la pidió. */
  rematch?: string;
}

// --- Eventos y salida --------------------------------------------------------------------------------------------------

export type RoomEvent =
  /** Se abrió una conexión (con el token de la URL, si trae). */
  | { readonly type: 'connect'; readonly conn: string; readonly token?: string; readonly entropy: string }
  /** Un mensaje del cliente. `newCode` es un código candidato para la revancha. */
  | { readonly type: 'message'; readonly conn: string; readonly message: ClientMessage; readonly entropy: string; readonly newCode?: string }
  | { readonly type: 'disconnect'; readonly conn: string; readonly entropy: string }
  /** Venció la alarma programada. */
  | { readonly type: 'alarm'; readonly entropy: string }
  /** No se pudo crear la sala de la revancha. */
  | { readonly type: 'rematchFailed'; readonly entropy: string };

export type Target =
  | { readonly to: 'all' }
  | { readonly to: 'players' }
  | { readonly to: 'spectators' }
  | { readonly to: 'player'; readonly id: string }
  | { readonly to: 'conn'; readonly conn: string };

export interface Outbound {
  readonly target: Target;
  readonly message: ServerMessage;
}

/** Algo que el objeto tiene que hacer afuera del reductor. */
export type Effect = { readonly type: 'createRoom'; readonly code: string; readonly state: RoomState };

export interface RoomOutput {
  readonly state: RoomState;
  /** Los mensajes a repartir, en orden. */
  readonly send: readonly Outbound[];
  /** Los vencimientos pendientes (el objeto programa el más cercano), de menor a mayor. */
  readonly alarms: readonly number[];
  /** Conexiones a cerrar después de repartir. */
  readonly close: readonly string[];
  /** La sala se borra. */
  readonly destroy: boolean;
  readonly effects: readonly Effect[];
}

// --- Utilidades --------------------------------------------------------------------------------------------------------

/** Un número en [0, 1) derivado del azar del evento. */
const unit = (entropy: string, salt: string): number => fnv1a32(`${entropy}|${salt}`) / 2 ** 32;

function checkEntropy(entropy: string): void {
  if (!/^[0-9a-f]+$/.test(entropy) || entropy.length < MIN_ENTROPY) throw new Error(`entropy: se necesitan ${MIN_ENTROPY} caracteres hexadecimales`);
}

const TERMINAL: ReadonlySet<GameStatus> = new Set(['solved', 'failed', 'surrendered', 'timeUp', 'abandoned']);
const isTerminal = (status: GameStatus): status is PartidaStatus => TERMINAL.has(status);

const playerOf = (s: RoomState, id: string | null | undefined): RoomPlayer | undefined => (id ? s.players.find((player) => player.id === id) : undefined);
const gameOf = (player: RoomPlayer, index: number): GameRecord | undefined => player.games.find((game) => game.index === index);
const activePlayers = (s: RoomState): RoomPlayer[] => s.players.filter((player) => !player.abandoned);
const totalMain = (s: RoomState): number => s.config.partidas.length;

function partidaAt(s: RoomState, index: number): Partida | undefined {
  return index <= totalMain(s) ? s.config.partidas[index - 1] : s.extra.find((game) => game.index === index)?.partida;
}

const currentGame = (s: RoomState, player: RoomPlayer): GameRecord | undefined => (player.current === null ? undefined : gameOf(player, player.current));

// --- Salas nuevas ------------------------------------------------------------------------------------------------------

export interface CreateRoomInput {
  readonly code: string;
  readonly config: VersusConfig;
  /** El apodo del creador, ya validado. */
  readonly name: string;
  readonly entropy: string;
  readonly now: number;
}

/** Una sala nueva en `lobby`, con su creador (que todavía no se conectó: si no aparece en 2 minutos, se va). */
export function createRoom(input: CreateRoomInput): { readonly state: RoomState; readonly playerId: string; readonly token: string } {
  checkEntropy(input.entropy);
  const name = input.name.trim();
  if (!isValidName(name)) throw new Error('apodo inválido');
  const playerId = `p${input.entropy.slice(0, 7)}`;
  const token = input.entropy.slice(8, 40);
  const host: RoomPlayer = { id: playerId, token, name, ready: false, joinedAt: input.now, disconnectedAt: input.now, abandoned: false, current: null, games: [] };
  const state: RoomState = {
    code: input.code,
    seed: input.entropy.slice(40, 56),
    config: input.config,
    phase: 'lobby',
    createdAt: input.now,
    lastActivityAt: input.now,
    hostId: playerId,
    players: [host],
    conns: {},
    extra: [],
    round: 0,
    tiebreakWon: false,
  };
  return { state, playerId, token };
}

// --- Vistas ------------------------------------------------------------------------------------------------------------

const playerView = (player: RoomPlayer): PlayerView => ({ id: player.id, name: player.name, ready: player.ready, connected: player.disconnectedAt === undefined, abandoned: player.abandoned });

function progressView(s: RoomState, player: RoomPlayer): ProgressView {
  const game = currentGame(s, player) ?? player.games[player.games.length - 1];
  return {
    playerId: player.id,
    index: player.current ?? 0,
    attempts: game?.attempts ?? 0,
    ...(game?.errors === undefined ? {} : { errors: game.errors }),
    ...(game?.score === undefined ? {} : { score: game.score }),
    status: game?.status ?? (player.abandoned ? 'abandoned' : 'pending'),
    done: player.games.filter((candidate) => isTerminal(candidate.status)).length,
  };
}

/** Los modos jugados de la sala, con su índice, para la votación. */
const playedOptions = (s: RoomState): PlayedOption[] => s.config.partidas.map((partida, index) => ({ index: index + 1, partida }));

function tiebreakView(s: RoomState, viewer?: RoomPlayer): TiebreakView | undefined {
  if (!s.vote) return undefined;
  const mine = viewer ? s.vote.votes[viewer.id] : undefined;
  return {
    round: s.vote.round,
    players: s.vote.tied,
    played: distinctModes(playedOptions(s)),
    votingEndsAt: s.vote.endsAt,
    voted: Object.keys(s.vote.votes).length,
    ...(mine ? { myVote: mine } : {}),
  };
}

function spinView(s: RoomState): SpinView | undefined {
  if (!s.spin) return undefined;
  return { options: s.spin.outcome.slices.map((slice) => ({ option: slice.option, votes: slice.votes })), winner: s.spin.outcome.winner, endsAt: s.spin.endsAt };
}

function resultsOf(s: RoomState, index: number, participants?: readonly string[]): PartidaResult[] {
  return s.players.flatMap((player) => {
    if (participants && !participants.includes(player.id)) return [];
    const game = gameOf(player, index);
    if (!game || !isTerminal(game.status)) return [];
    return [{ playerId: player.id, status: game.status, elapsedMs: game.elapsedMs, finishedAtMs: game.finishedAtMs, attempts: game.attempts, score: game.score, scores: game.scores }];
  });
}

const mainPlayed = (s: RoomState): PlayedPartida[] =>
  s.config.partidas.map((partida, index) => ({ engine: partida.engine, timeLimitMs: partida.timeLimitMs, results: resultsOf(s, index + 1) }));

/** Lo que se muestra al final: la tabla, el detalle de cada partida con sus respuestas y las grillas. */
export function buildResults(s: RoomState): Results {
  const ids = s.players.map((player) => player.id);
  const options = s.config.options;
  const detail = (index: number, partida: Partida, tiebreak: boolean, participants: readonly string[]) => ({
    index,
    tiebreak,
    partida,
    ranking: rankPartida(s.config.modality, { engine: partida.engine, timeLimitMs: partida.timeLimitMs, results: resultsOf(s, index, participants) }, participants, options).map((group) => [...group]),
    games: participants.flatMap((id) => {
      const player = playerOf(s, id);
      const game = player && gameOf(player, index);
      if (!game) return [];
      return [
        {
          playerId: id,
          status: game.status,
          ...(game.elapsedMs === undefined ? {} : { elapsedMs: game.elapsedMs }),
          ...(game.finishedAtMs === undefined ? {} : { finishedAtMs: game.finishedAtMs }),
          attempts: game.attempts,
          ...(game.score === undefined ? {} : { score: game.score }),
          ...(game.scores === undefined ? {} : { scores: game.scores }),
          ...(game.grid === undefined ? {} : { grid: game.grid }),
          ...(game.answer === undefined ? {} : { answer: game.answer }),
        },
      ];
    }),
  });
  return {
    modality: s.config.modality,
    table: s.table ?? [],
    players: s.players.map((player) => ({ id: player.id, name: player.name })),
    tiebreakWon: s.tiebreakWon,
    partidas: [
      ...s.config.partidas.map((partida, index) => detail(index + 1, partida, false, ids)),
      ...s.extra.map((game) => detail(game.index, game.partida, true, game.participants)),
    ],
  };
}

/** Todo lo que ve una conexión de la sala (al conectar y ante cualquier duda). Un espectador no recibe la semilla. */
export function snapshotFor(s: RoomState, conn: string, now: number, newToken?: string): Snapshot {
  const player = playerOf(s, s.conns[conn]);
  const game = player ? currentGame(s, player) : undefined;
  const tiebreak = tiebreakView(s, player);
  const spin = spinView(s);
  return {
    type: 'snapshot',
    protocol: PROTOCOL_VERSION,
    serverNow: now,
    code: s.code,
    phase: s.phase,
    config: s.config,
    you: { ...(player ? { playerId: player.id } : {}), ...(newToken ? { token: newToken } : {}), spectator: !player },
    hostId: s.hostId,
    players: s.players.map(playerView),
    ...(player && s.phase !== 'lobby' ? { seed: s.seed } : {}),
    ...(s.startsAt === undefined ? {} : { startsAt: s.startsAt }),
    progress: s.players.map((candidate) => progressView(s, candidate)),
    ...(player && game ? { mine: { index: game.index, status: game.status, ...(game.startedAt === undefined ? {} : { startedAt: game.startedAt }), ...(game.endsAt === undefined ? {} : { endsAt: game.endsAt }) } } : {}),
    tiebreakGames: s.extra.map((extra) => ({ index: extra.index, partida: extra.partida })),
    ...(tiebreak ? { tiebreak } : {}),
    ...(spin ? { spin } : {}),
    ...(s.phase === 'finished' ? { results: buildResults(s) } : {}),
    ...(s.rematch ? { rematch: s.rematch } : {}),
  };
}

/** Las conexiones a las que llega un mensaje. Las de `conn` valen aunque ya no estén en la sala (las que se están cerrando). */
export function resolveTarget(s: RoomState, target: Target): string[] {
  const entries = Object.entries(s.conns);
  switch (target.to) {
    case 'all':
      return entries.map(([conn]) => conn);
    case 'players':
      return entries.filter(([, id]) => id !== null).map(([conn]) => conn);
    case 'spectators':
      return entries.filter(([, id]) => id === null).map(([conn]) => conn);
    case 'player':
      return entries.filter(([, id]) => id === target.id).map(([conn]) => conn);
    case 'conn':
      return [target.conn];
  }
}

// --- Temporizadores ----------------------------------------------------------------------------------------------------

export interface Timer {
  readonly at: number;
  readonly kind: 'countdown' | 'limit' | 'pending' | 'reconnect' | 'vote' | 'spin' | 'idle' | 'expire';
  readonly playerId?: string;
}

/** Todos los vencimientos que tiene la sala, derivados del estado (no se guardan aparte), de menor a mayor. */
export function timersOf(s: RoomState): Timer[] {
  const timers: Timer[] = [];
  const playing = s.phase === 'playing' || s.phase === 'tiebreakPlaying';
  if (s.phase === 'countdown' && s.startsAt !== undefined) timers.push({ at: s.startsAt, kind: 'countdown' });
  for (const player of s.players) {
    const game = currentGame(s, player);
    if (playing && game?.status === 'playing' && game.endsAt !== undefined) timers.push({ at: game.endsAt, kind: 'limit', playerId: player.id });
    if (playing && game?.status === 'pending' && game.pendingSince !== undefined) timers.push({ at: game.pendingSince + LOAD_GRACE_MS, kind: 'pending', playerId: player.id });
    if (s.phase !== 'finished' && player.disconnectedAt !== undefined && !player.abandoned) timers.push({ at: player.disconnectedAt + RECONNECT_MS, kind: 'reconnect', playerId: player.id });
  }
  if (s.vote) timers.push({ at: s.vote.endsAt, kind: 'vote' });
  if (s.spin) timers.push({ at: s.spin.endsAt, kind: 'spin' });
  if (s.phase === 'lobby') timers.push({ at: s.lastActivityAt + LOBBY_IDLE_MS, kind: 'idle' });
  if (s.phase === 'finished' && s.finishedAt !== undefined) timers.push({ at: s.finishedAt + FINISHED_TTL_MS, kind: 'expire' });
  return timers.sort((a, b) => a.at - b.at);
}

// --- Contexto de un paso -----------------------------------------------------------------------------------------------

interface Ctx {
  s: RoomState;
  now: number;
  entropy: string;
  send: Outbound[];
  close: string[];
  effects: Effect[];
  destroy: boolean;
}

function emit(ctx: Ctx, target: Target, message: ServerMessage): void {
  ctx.send.push({ target, message });
}

const toAll = (ctx: Ctx, message: ServerMessage) => emit(ctx, { to: 'all' }, message);
const toPlayer = (ctx: Ctx, id: string, message: ServerMessage) => emit(ctx, { to: 'player', id }, message);

function error(ctx: Ctx, conn: string, code: ErrorCode, message?: string): void {
  emit(ctx, { to: 'conn', conn }, { type: 'error', code, ...(message ? { message } : {}) });
}

function emitPlayers(ctx: Ctx): void {
  toAll(ctx, { type: 'players', hostId: ctx.s.hostId, players: ctx.s.players.map(playerView) });
}

const emitProgress = (ctx: Ctx, player: RoomPlayer): void => toAll(ctx, { type: 'progress', progress: progressView(ctx.s, player) });

// --- Partidas de un jugador --------------------------------------------------------------------------------------------

/** La partida empieza para el jugador a la hora `startAt`; en Contrarreloj, con su vencimiento. */
function beginGame(ctx: Ctx, player: RoomPlayer, game: GameRecord, startAt: number): void {
  const { s } = ctx;
  game.status = 'playing';
  game.pendingSince = undefined;
  game.startedAt = startAt;
  const limit = partidaAt(s, game.index)?.timeLimitMs;
  if (s.config.modality === 'timeAttack' && limit !== undefined) game.endsAt = startAt + limit;
  toPlayer(ctx, player.id, { type: 'partidaStart', index: game.index, at: startAt, ...(game.endsAt === undefined ? {} : { endsAt: game.endsAt }) });
  emitProgress(ctx, player);
}

/**
 * Le abre al jugador la partida `index`. En Carrera corre desde ya (el reloj no se detiene: cuenta también la carga); en las
 * otras modalidades espera el aviso `loaded` (la pista ya se ve) y, si no llega, empieza sola a los 30 s.
 */
function openGame(ctx: Ctx, player: RoomPlayer, index: number, at: number): void {
  const game: GameRecord = { index, status: 'pending', pendingSince: at, attempts: 0 };
  player.games.push(game);
  player.current = index;
  if (ctx.s.config.modality === 'race') beginGame(ctx, player, game, at);
  else emitProgress(ctx, player);
}

/** Cierra la partida del jugador y le abre la siguiente (o lo deja sin partidas). */
function closeGame(ctx: Ctx, player: RoomPlayer, game: GameRecord, status: PartidaStatus, at: number, data: Partial<GameRecord> = {}): void {
  const { s } = ctx;
  Object.assign(game, data);
  game.status = status;
  game.pendingSince = undefined;
  const started = game.startedAt ?? at;
  const limit = partidaAt(s, game.index)?.timeLimitMs;
  game.elapsedMs = status === 'timeUp' && limit !== undefined ? limit : Math.max(0, at - started);
  game.finishedAtMs = Math.max(0, at - (s.startsAt ?? at));
  game.endsAt = undefined;
  if (game.index < totalMain(s) && s.phase === 'playing') openGame(ctx, player, game.index + 1, at);
  else player.current = null;
  emitProgress(ctx, player);
}

// --- Final de la sala --------------------------------------------------------------------------------------------------

function finishRoom(ctx: Ctx, at: number): void {
  const { s } = ctx;
  s.phase = 'finished';
  s.finishedAt = at;
  s.vote = undefined;
  s.spin = undefined;
  toAll(ctx, { type: 'results', results: buildResults(s) });
}

function startVote(ctx: Ctx, tied: readonly string[], at: number): void {
  const { s } = ctx;
  const candidates = tied.filter((id) => !playerOf(s, id)?.abandoned);
  if (candidates.length < 2) {
    // Quien se quedó solo gana el desempate; los demás empatados lo pierden (abandonaron).
    if (candidates.length === 1 && s.table) {
      s.table = applyTiebreak(s.table, [candidates]);
      s.tiebreakWon = true;
    }
    finishRoom(ctx, at);
    return;
  }
  s.round += 1;
  s.phase = 'tiebreakVote';
  s.vote = { round: s.round, tied: candidates, votes: {}, endsAt: at + VOTE_MS };
  const view = tiebreakView(s);
  if (view) toAll(ctx, { type: 'tiebreak', tiebreak: view });
}

function closeMain(ctx: Ctx, at: number): void {
  const { s } = ctx;
  const players = s.players.map((player) => ({ id: player.id, abandoned: player.abandoned }));
  s.table = finalTable(s.config.modality, players, mainPlayed(s), s.config.options);
  const tied = tiedForFirst(s.table);
  if (tied.length >= 2) startVote(ctx, tied, at);
  else finishRoom(ctx, at);
}

function closeTiebreak(ctx: Ctx, at: number): void {
  const { s } = ctx;
  const game = s.extra[s.extra.length - 1];
  const standing = game.participants.filter((id) => !playerOf(s, id)?.abandoned);
  // Con un solo participante que sigue, gana; si no, el orden lo da la partida con las reglas de su modalidad.
  const ranking =
    standing.length <= 1
      ? [standing]
      : rankPartida(s.config.modality, { engine: game.partida.engine, timeLimitMs: game.partida.timeLimitMs, results: resultsOf(s, game.index, game.participants) }, game.participants, s.config.options);
  s.table = applyTiebreak(s.table ?? [], ranking);
  s.tiebreakWon = true;
  const tied = tiedForFirst(s.table);
  if (tied.length >= 2) startVote(ctx, tied, at);
  else finishRoom(ctx, at);
}

function closeVote(ctx: Ctx, at: number): void {
  const { s } = ctx;
  const vote = s.vote;
  if (!vote) return;
  const voters = vote.tied.filter((id) => vote.votes[id] !== undefined);
  const outcome = tiebreakOutcome(voters.map((id) => vote.votes[id]), playedOptions(s), unit(ctx.entropy, `spin:${vote.round}`));
  toAll(ctx, { type: 'votes', voted: voters.length, total: vote.tied.length, votes: voters.map((id) => ({ playerId: id, option: vote.votes[id] })) });
  s.phase = 'tiebreakSpin';
  s.vote = undefined;
  s.spin = { endsAt: at + SPIN_MS, outcome, participants: vote.tied };
  const view = spinView(s);
  if (view) toAll(ctx, { type: 'spin', spin: view });
}

function startTiebreakGame(ctx: Ctx, at: number): void {
  const { s } = ctx;
  const spin = s.spin;
  if (!spin) return;
  const index = TIEBREAK_FIRST_INDEX + s.extra.length;
  const chosen = spin.outcome.partida;
  // En Contrarreloj el desempate usa el tiempo por defecto de su tipo de modo (no el que se haya editado).
  const limit = chosen.defaultTimeLimitMs ?? defaultTimeLimit(chosen.engine, chosen.series.length, 0);
  const partida: Partida = { ...chosen, ...(s.config.modality === 'timeAttack' ? { timeLimitMs: limit } : {}) };
  const participants = spin.participants.filter((id) => !playerOf(s, id)?.abandoned);
  s.extra.push({ index, partida, participants: spin.participants });
  s.phase = 'tiebreakPlaying';
  s.spin = undefined;
  for (const id of participants) {
    const player = playerOf(s, id);
    if (player) openGame(ctx, player, index, at);
  }
  toAll(ctx, { type: 'tiebreakStart', index, partida, at });
}

/** Fin anticipado de Mayor o Menor (Menos intentos): quien ya superó a todos los que terminaron, termina solo. */
function earlyEnd(ctx: Ctx): void {
  const { s } = ctx;
  if (s.config.modality !== 'fewestAttempts') return;
  for (const player of s.players) {
    const game = currentGame(s, player);
    if (!game || game.status !== 'playing' || game.endNowSent || partidaAt(s, game.index)?.engine !== 'higher-lower') continue;
    const group = game.index > totalMain(s) ? (s.extra.find((extra) => extra.index === game.index)?.participants ?? []) : s.players.map((candidate) => candidate.id);
    const scores = group.flatMap((id) => {
      const other = playerOf(s, id);
      if (!other) return [];
      const otherGame = gameOf(other, game.index);
      return [{ playerId: id, finished: other.abandoned || (otherGame !== undefined && isTerminal(otherGame.status)), score: otherGame?.score ?? 0 }];
    });
    if (higherLowerEarlyEnd(scores, player.id)) {
      game.endNowSent = true;
      toPlayer(ctx, player.id, { type: 'endNow', index: game.index });
    }
  }
}

/** Después de cualquier cambio: ¿terminó alguna etapa? Cierra las que correspondan, una atrás de otra. */
function settle(ctx: Ctx, at: number): void {
  for (let guard = 0; guard < 25; guard++) {
    const { s } = ctx;
    if (s.phase === 'playing') {
      const active = activePlayers(s);
      const sole = s.players.length >= 2 && active.length <= 1;
      if (sole || active.every((player) => player.current === null)) {
        closeMain(ctx, at);
        continue;
      }
      earlyEnd(ctx);
      return;
    }
    if (s.phase === 'tiebreakPlaying') {
      const game = s.extra[s.extra.length - 1];
      const standing = game.participants.map((id) => playerOf(s, id)).filter((player): player is RoomPlayer => player !== undefined && !player.abandoned);
      if (standing.length <= 1 || standing.every((player) => player.current === null)) {
        closeTiebreak(ctx, at);
        continue;
      }
      earlyEnd(ctx);
      return;
    }
    if (s.phase === 'tiebreakVote' && s.vote) {
      const vote = s.vote;
      vote.tied = vote.tied.filter((id) => !playerOf(s, id)?.abandoned);
      if (vote.tied.length < 2) {
        startVote(ctx, vote.tied, at);
        continue;
      }
      if (vote.tied.every((id) => vote.votes[id] !== undefined)) {
        closeVote(ctx, at);
      }
      return;
    }
    return;
  }
}

// --- Jugadores que se van ----------------------------------------------------------------------------------------------

/** El creador se fue: el rol pasa al jugador que entró después de él (y, si era el último, al primero). */
function reassignHost(s: RoomState, order: readonly string[]): void {
  const start = order.indexOf(s.hostId);
  for (let step = 1; step <= order.length; step++) {
    const candidate = playerOf(s, order[(start + step) % order.length]);
    if (candidate && !candidate.abandoned) {
      s.hostId = candidate.id;
      return;
    }
  }
}

/** Sala de espera (o cuenta regresiva): el jugador se va sin consecuencias. */
function removePlayer(ctx: Ctx, player: RoomPlayer): void {
  const { s } = ctx;
  const order = s.players.map((candidate) => candidate.id);
  s.players = s.players.filter((candidate) => candidate.id !== player.id);
  for (const [conn, id] of Object.entries(s.conns)) {
    if (id === player.id) {
      ctx.close.push(conn);
      delete s.conns[conn];
    }
  }
  if (s.players.length === 0) {
    ctx.destroy = true;
    return;
  }
  if (s.hostId === player.id) reassignHost(s, order);
  if (s.phase === 'countdown' && s.players.length < 2) {
    s.phase = 'lobby';
    s.startsAt = undefined;
    toAll(ctx, { type: 'lobby', serverNow: ctx.now });
  }
  emitPlayers(ctx);
}

/** Después de empezar: el jugador abandona (se desconectó más de 2 minutos o tocó Salir). */
function abandonPlayer(ctx: Ctx, player: RoomPlayer, at: number): void {
  const { s } = ctx;
  if (player.abandoned) return;
  const game = currentGame(s, player);
  player.abandoned = true;
  player.disconnectedAt = undefined;
  if (game && (game.status === 'pending' || game.status === 'playing')) {
    game.status = 'abandoned';
    game.pendingSince = undefined;
    game.endsAt = undefined;
    game.elapsedMs = Math.max(0, at - (game.startedAt ?? at));
  }
  player.current = null;
  if (s.hostId === player.id) reassignHost(s, s.players.map((candidate) => candidate.id));
  emitPlayers(ctx);
  emitProgress(ctx, player);
}

function leave(ctx: Ctx, player: RoomPlayer, at: number): void {
  const { s } = ctx;
  if (s.phase === 'lobby' || s.phase === 'countdown') removePlayer(ctx, player);
  else if (s.phase !== 'finished') abandonPlayer(ctx, player, at);
}

// --- Mensajes ----------------------------------------------------------------------------------------------------------

function sendSnapshot(ctx: Ctx, conn: string, newToken?: string): void {
  emit(ctx, { to: 'conn', conn }, snapshotFor(ctx.s, conn, ctx.now, newToken));
}

function spectate(ctx: Ctx, conn: string): void {
  const spectators = Object.values(ctx.s.conns).filter((id) => id === null).length;
  if (spectators > MAX_SPECTATORS) {
    error(ctx, conn, 'room_full');
    ctx.close.push(conn);
    delete ctx.s.conns[conn];
    return;
  }
  sendSnapshot(ctx, conn);
}

function hello(ctx: Ctx, conn: string, message: Extract<ClientMessage, { type: 'hello' }>, entropy: string): void {
  const { s } = ctx;
  if (message.protocol !== PROTOCOL_VERSION) {
    error(ctx, conn, 'protocol_mismatch', 'Actualizá la página');
    ctx.close.push(conn);
    delete s.conns[conn];
    return;
  }
  if (s.conns[conn]) {
    sendSnapshot(ctx, conn);
    return;
  }
  if (message.name === undefined) {
    spectate(ctx, conn);
    return;
  }
  const name = message.name.trim();
  if (!isValidName(name)) {
    error(ctx, conn, 'bad_message', 'apodo inválido');
    return;
  }
  if (s.phase !== 'lobby') {
    error(ctx, conn, 'already_started');
    spectate(ctx, conn);
    return;
  }
  if (s.players.length >= LIMITS.players.max) {
    error(ctx, conn, 'room_full');
    spectate(ctx, conn);
    return;
  }
  checkEntropy(entropy);
  const id = `p${entropy.slice(0, 7)}`;
  const token = entropy.slice(8, 40);
  const player: RoomPlayer = { id, token, name, ready: false, joinedAt: ctx.now, abandoned: false, current: null, games: [] };
  s.players.push(player);
  s.conns[conn] = id;
  s.lastActivityAt = ctx.now;
  sendSnapshot(ctx, conn, token);
  emitPlayers(ctx);
}

function loaded(ctx: Ctx, conn: string, player: RoomPlayer, index: number): void {
  const game = gameOf(player, index);
  if (!game || player.current !== index) return error(ctx, conn, 'bad_message');
  // Un aviso repetido (por ejemplo, al recargar la página) no cambia nada.
  if (game.status === 'pending') beginGame(ctx, player, game, ctx.now);
}

function progress(ctx: Ctx, conn: string, player: RoomPlayer, message: Extract<ClientMessage, { type: 'progress' }>): void {
  const game = gameOf(player, message.index);
  if (!game) return error(ctx, conn, 'bad_message');
  // Un aviso que llega después de que el servidor cerró la partida (se acabó el tiempo) no es un error.
  if (isTerminal(game.status)) return;
  if (player.current !== message.index || game.status !== 'playing') return error(ctx, conn, 'bad_message');
  game.attempts = message.attempts;
  if (message.errors !== undefined) game.errors = message.errors;
  if (message.score !== undefined) game.score = message.score;
  emitProgress(ctx, player);
}

function finish(ctx: Ctx, conn: string, player: RoomPlayer, message: Extract<ClientMessage, { type: 'finish' }>): void {
  const game = gameOf(player, message.index);
  if (!game) return error(ctx, conn, 'bad_message');
  const report = { attempts: message.attempts, grid: message.grid, answer: message.answer, ...(message.score === undefined ? {} : { score: message.score }), ...(message.scores === undefined ? {} : { scores: message.scores }) };
  // Si el servidor ya cerró la partida (se acabó el tiempo, se rindió), el aviso solo suma la grilla y la respuesta.
  if (isTerminal(game.status) && game.answer === undefined && (game.status === 'timeUp' || game.status === 'surrendered')) {
    game.grid = message.grid;
    game.answer = message.answer;
    return;
  }
  if (player.current !== message.index || game.status !== 'playing') return error(ctx, conn, 'bad_message');
  if (ctx.s.config.modality === 'race' && !message.won) return error(ctx, conn, 'not_allowed');
  closeGame(ctx, player, game, message.won ? 'solved' : 'failed', ctx.now, report);
}

function surrender(ctx: Ctx, conn: string, player: RoomPlayer, index: number): void {
  if (ctx.s.config.modality === 'race') return error(ctx, conn, 'not_allowed');
  const game = gameOf(player, index);
  if (!game) return error(ctx, conn, 'bad_message');
  if (isTerminal(game.status)) return;
  if (player.current !== index || game.status !== 'playing') return error(ctx, conn, 'bad_message');
  closeGame(ctx, player, game, 'surrendered', ctx.now);
}

function vote(ctx: Ctx, conn: string, player: RoomPlayer, option: TiebreakVote): void {
  const { s } = ctx;
  if (s.phase !== 'tiebreakVote' || !s.vote || !s.vote.tied.includes(player.id)) return error(ctx, conn, 'not_allowed');
  if ('played' in option && option.played > totalMain(s)) return error(ctx, conn, 'bad_message');
  s.vote.votes[player.id] = option;
  toAll(ctx, { type: 'votes', voted: Object.keys(s.vote.votes).length, total: s.vote.tied.length });
}

function rematch(ctx: Ctx, conn: string, player: RoomPlayer, newCode: string | undefined, entropy: string): void {
  const { s } = ctx;
  if (s.hostId !== player.id) return error(ctx, conn, 'not_host');
  if (s.phase !== 'finished') return error(ctx, conn, 'not_allowed');
  if (s.rematch) {
    toAll(ctx, { type: 'rematch', code: s.rematch });
    return;
  }
  if (!newCode) return error(ctx, conn, 'bad_message');
  checkEntropy(entropy);
  const stay = s.players.filter((candidate) => !candidate.abandoned && candidate.disconnectedAt === undefined);
  const players: RoomPlayer[] = stay.map((candidate) => ({ id: candidate.id, token: candidate.token, name: candidate.name, ready: false, joinedAt: ctx.now, abandoned: false, current: null, games: [] }));
  const state: RoomState = {
    code: newCode,
    seed: entropy.slice(40, 56),
    config: s.config,
    phase: 'lobby',
    createdAt: ctx.now,
    lastActivityAt: ctx.now,
    hostId: player.id,
    players,
    conns: {},
    extra: [],
    round: 0,
    tiebreakWon: false,
  };
  // Los jugadores se conectan a la sala nueva con su mismo token: hasta que lleguen, figuran desconectados.
  for (const candidate of players) candidate.disconnectedAt = ctx.now;
  s.rematch = newCode;
  ctx.effects.push({ type: 'createRoom', code: newCode, state });
  toAll(ctx, { type: 'rematch', code: newCode });
}

function onMessage(ctx: Ctx, event: Extract<RoomEvent, { type: 'message' }>): void {
  const { s } = ctx;
  const { conn, message } = event;
  if (!(conn in s.conns)) return;
  if (message.type === 'hello') return hello(ctx, conn, message, event.entropy);
  const player = playerOf(s, s.conns[conn]);
  if (!player) return error(ctx, conn, 'not_allowed');
  if (s.phase === 'lobby') s.lastActivityAt = ctx.now;

  switch (message.type) {
    case 'ready':
      if (s.phase !== 'lobby') return error(ctx, conn, 'not_allowed');
      player.ready = message.value;
      return emitPlayers(ctx);
    case 'start': {
      if (s.hostId !== player.id) return error(ctx, conn, 'not_host');
      if (s.phase !== 'lobby' || s.players.filter((candidate) => candidate.ready).length < 2) return error(ctx, conn, 'not_allowed');
      s.phase = 'countdown';
      s.startsAt = ctx.now + COUNTDOWN_MS;
      emit(ctx, { to: 'players' }, { type: 'countdown', startsAt: s.startsAt, serverNow: ctx.now, seed: s.seed });
      emit(ctx, { to: 'spectators' }, { type: 'countdown', startsAt: s.startsAt, serverNow: ctx.now });
      return;
    }
    case 'kick': {
      if (s.hostId !== player.id) return error(ctx, conn, 'not_host');
      const target = playerOf(s, message.playerId);
      if (s.phase !== 'lobby' || !target || target.id === player.id) return error(ctx, conn, 'not_allowed');
      for (const [other, id] of Object.entries(s.conns)) if (id === target.id) error(ctx, other, 'kicked');
      return removePlayer(ctx, target);
    }
    case 'loaded':
      return loaded(ctx, conn, player, message.index);
    case 'progress':
      return progress(ctx, conn, player, message);
    case 'finish':
      return finish(ctx, conn, player, message);
    case 'surrender':
      return surrender(ctx, conn, player, message.index);
    case 'vote':
      return vote(ctx, conn, player, message.option);
    case 'leave': {
      leave(ctx, player, ctx.now);
      // Salir cierra todas las conexiones del jugador (las de la sala de espera ya se cerraron al sacarlo).
      for (const [other, id] of Object.entries(s.conns)) if (id === player.id) ctx.close.push(other);
      return;
    }
    case 'rematch':
      return rematch(ctx, conn, player, event.newCode, event.entropy);
  }
}

// --- Temporizadores vencidos -------------------------------------------------------------------------------------------

function startPlaying(ctx: Ctx, at: number): void {
  const { s } = ctx;
  s.phase = 'playing';
  for (const player of activePlayers(s)) {
    const game: GameRecord = { index: 1, status: 'pending', attempts: 0 };
    player.games.push(game);
    player.current = 1;
    beginGame(ctx, player, game, at);
  }
}

function processTimer(ctx: Ctx, timer: Timer): void {
  const { s } = ctx;
  const player = playerOf(s, timer.playerId);
  switch (timer.kind) {
    case 'countdown':
      return startPlaying(ctx, timer.at);
    case 'limit': {
      const game = player && currentGame(s, player);
      if (!player || !game) return;
      // Gana la alarma: el aviso de fin que llegue después se ignora.
      closeGame(ctx, player, game, 'timeUp', timer.at);
      toPlayer(ctx, player.id, { type: 'timeUp', index: game.index });
      return;
    }
    case 'pending': {
      const game = player && currentGame(s, player);
      if (player && game) beginGame(ctx, player, game, timer.at);
      return;
    }
    case 'reconnect':
      if (player) leave(ctx, player, timer.at);
      return;
    case 'vote':
      return closeVote(ctx, timer.at);
    case 'spin':
      return startTiebreakGame(ctx, timer.at);
    case 'idle':
    case 'expire':
      ctx.destroy = true;
  }
}

/** Corre los vencimientos anteriores a `now` (o hasta `now`, si el evento es la alarma), cada uno a su hora. */
function runTimers(ctx: Ctx, inclusive: boolean): void {
  for (let i = 0; i < 500 && !ctx.destroy; i++) {
    const next = timersOf(ctx.s)[0];
    if (!next || (inclusive ? next.at > ctx.now : next.at >= ctx.now)) return;
    processTimer(ctx, next);
    settle(ctx, next.at);
  }
}

// --- El reductor -------------------------------------------------------------------------------------------------------

/**
 * Procesa un evento: primero los vencimientos que ya pasaron (cada uno a su hora, así un fin de tiempo gana a un aviso que
 * llega después) y luego el evento. No modifica `state`: devuelve el nuevo.
 */
export function reduce(state: RoomState, event: RoomEvent, now: number): RoomOutput {
  checkEntropy(event.entropy);
  const ctx: Ctx = { s: structuredClone(state), now, entropy: event.entropy, send: [], close: [], effects: [], destroy: false };
  runTimers(ctx, event.type === 'alarm');
  if (!ctx.destroy) {
    switch (event.type) {
      case 'connect': {
        ctx.s.conns[event.conn] = null;
        const player = event.token ? ctx.s.players.find((candidate) => candidate.token === event.token && !candidate.abandoned) : undefined;
        if (player) {
          ctx.s.conns[event.conn] = player.id;
          if (player.disconnectedAt !== undefined) {
            player.disconnectedAt = undefined;
            emitPlayers(ctx);
          }
        }
        break;
      }
      case 'message':
        onMessage(ctx, event);
        break;
      case 'disconnect': {
        const id = ctx.s.conns[event.conn];
        delete ctx.s.conns[event.conn];
        const player = playerOf(ctx.s, id);
        if (player && !Object.values(ctx.s.conns).includes(player.id) && player.disconnectedAt === undefined) {
          player.disconnectedAt = now;
          emitPlayers(ctx);
        }
        break;
      }
      case 'rematchFailed':
        if (ctx.s.rematch) {
          ctx.s.rematch = undefined;
          const host = playerOf(ctx.s, ctx.s.hostId);
          if (host) toPlayer(ctx, host.id, { type: 'error', code: 'not_allowed', message: 'No se pudo crear la revancha' });
        }
        break;
      case 'alarm':
        break;
    }
    settle(ctx, now);
  }
  return { state: ctx.s, send: ctx.send, alarms: ctx.destroy ? [] : timersOf(ctx.s).map((timer) => timer.at), close: ctx.close, destroy: ctx.destroy, effects: ctx.effects };
}
