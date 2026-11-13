import { z } from 'zod';
import { MODALITIES, partidaSchema, versusConfigSchema } from './config';

// Los mensajes entre el sitio y el servidor de salas (docs/versus/02-arquitectura.md, "Protocolo"). Lógica pura
// compartida: solo imports relativos. Cliente → servidor y servidor → cliente son dos uniones discriminadas por `type`.

/** La versión del protocolo: va en el `hello`. Un cliente con otra recibe `protocol_mismatch` ("Actualizá la página"). */
export const PROTOCOL_VERSION = 1;

/** Un mensaje del cliente de más de esto se rechaza sin parsear. */
export const MAX_MESSAGE_BYTES = 2048;

/** Los pings se responden con la respuesta automática de hibernación (no despiertan la sala). */
export const PING = 'ping';
export const PONG = 'pong';

export const ERROR_CODES = [
  'room_full',
  'already_started',
  'not_host',
  'bad_message',
  'room_closed',
  'protocol_mismatch',
  'not_allowed',
  'kicked',
  'too_large',
  'rate_limited',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

// --- Piezas ------------------------------------------------------------------------------------------------------------

const playerId = z.string().min(1).max(16);
const count = z.number().int().min(0).max(100_000);
const index = z.number().int().min(1).max(99);
/** Una hora del servidor, en ms desde la época. */
const time = z.number().int().min(0);

/** La respuesta de una partida, como la muestra el marco al terminar (sin imagen embebida: solo el nombre del archivo). */
export const answerSchema = z.strictObject({
  label: z.string().max(200),
  detail: z.string().max(100).optional(),
  imageStem: z.string().max(120).optional(),
});
export type Answer = z.infer<typeof answerSchema>;

/** Una grilla de colores para mostrar al final: el cliente recorta a las últimas líneas para entrar en 2 KB. */
export const gridSchema = z.array(z.string().max(24)).max(20);

/** Lo que vota un empatado: un modo jugado (por el índice de su partida) u otro modo. */
export const tiebreakVoteSchema = z.union([z.strictObject({ played: index }), z.strictObject({ other: partidaSchema })]);

export const PARTIDA_STATUSES = ['solved', 'failed', 'surrendered', 'timeUp', 'abandoned'] as const;
/** Cómo va la partida de un jugador: sin empezar, jugando, o cómo terminó. */
const gameStatus = z.enum(['pending', 'playing', ...PARTIDA_STATUSES]);

// --- Cliente → servidor ------------------------------------------------------------------------------------------------

export const clientMessageSchema = z.discriminatedUnion('type', [
  /** Al conectar. Con token (en la URL) recupera su lugar; sin token y con `name`, se une si hay lugar y no empezó. */
  z.strictObject({ type: z.literal('hello'), protocol: z.number().int(), name: z.string().max(64).optional() }),
  z.strictObject({ type: z.literal('ready'), value: z.boolean() }),
  z.strictObject({ type: z.literal('start') }),
  z.strictObject({ type: z.literal('kick'), playerId }),
  /** La pista de la partida ya se ve: marca el inicio de las partidas 2 en adelante. */
  z.strictObject({ type: z.literal('loaded'), index }),
  z.strictObject({ type: z.literal('progress'), index, attempts: count, errors: count.optional(), score: count.optional() }),
  z.strictObject({
    type: z.literal('finish'),
    index,
    won: z.boolean(),
    attempts: count,
    score: count.optional(),
    scores: z.array(count).max(100).optional(),
    grid: gridSchema,
    answer: answerSchema,
  }),
  z.strictObject({ type: z.literal('surrender'), index }),
  z.strictObject({ type: z.literal('vote'), option: tiebreakVoteSchema }),
  z.strictObject({ type: z.literal('leave') }),
  z.strictObject({ type: z.literal('rematch') }),
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;

// --- Servidor → cliente ------------------------------------------------------------------------------------------------

export const PHASES = ['lobby', 'countdown', 'playing', 'tiebreakVote', 'tiebreakSpin', 'tiebreakPlaying', 'finished'] as const;
export const phaseSchema = z.enum(PHASES);
export type Phase = (typeof PHASES)[number];

export const playerViewSchema = z.strictObject({
  id: playerId,
  name: z.string(),
  ready: z.boolean(),
  connected: z.boolean(),
  abandoned: z.boolean(),
});
export type PlayerView = z.infer<typeof playerViewSchema>;

/** Lo que se ve de los rivales mientras se juega: nunca sus intentos (nombres ni colores). */
export const progressViewSchema = z.strictObject({
  playerId,
  /** La partida en la que va (0 si ya terminó todas). */
  index: z.number().int().min(0).max(99),
  attempts: count,
  errors: count.optional(),
  score: count.optional(),
  status: gameStatus,
  /** Cuántas partidas terminó. */
  done: z.number().int().min(0).max(99),
});
export type ProgressView = z.infer<typeof progressViewSchema>;

export const tableRowSchema = z.strictObject({
  playerId,
  place: z.number().int().min(1),
  totalMs: z.number().optional(),
  arrivalMs: z.number().optional(),
  halfPoints: z.number().optional(),
});

const playedOptionSchema = z.strictObject({ index, partida: partidaSchema });

export const tiebreakViewSchema = z.strictObject({
  round: z.number().int().min(1),
  players: z.array(playerId),
  played: z.array(playedOptionSchema),
  votingEndsAt: time,
  /** Cuántos votaron. */
  voted: z.number().int().min(0),
  /** El voto propio, si es uno de los empatados. */
  myVote: tiebreakVoteSchema.optional(),
});
export type TiebreakView = z.infer<typeof tiebreakViewSchema>;

export const spinViewSchema = z.strictObject({
  options: z.array(z.strictObject({ option: tiebreakVoteSchema, votes: z.number().int().min(0) })),
  winner: z.number().int().min(0),
  endsAt: time,
});
export type SpinView = z.infer<typeof spinViewSchema>;

export const gameViewSchema = z.strictObject({
  playerId,
  status: gameStatus,
  elapsedMs: z.number().optional(),
  finishedAtMs: z.number().optional(),
  attempts: count.optional(),
  score: count.optional(),
  scores: z.array(count).optional(),
  grid: gridSchema.optional(),
  answer: answerSchema.optional(),
});

export const partidaResultSchema = z.strictObject({
  index,
  tiebreak: z.boolean(),
  partida: partidaSchema,
  /** El orden de la partida, con empates: grupos del primer puesto al último. */
  ranking: z.array(z.array(playerId)),
  games: z.array(gameViewSchema),
});

export const resultsSchema = z.strictObject({
  modality: z.enum(MODALITIES),
  table: z.array(tableRowSchema),
  players: z.array(z.strictObject({ id: playerId, name: z.string() })),
  /** Si el primer puesto se decidió con un desempate. */
  tiebreakWon: z.boolean(),
  partidas: z.array(partidaResultSchema),
});
export type Results = z.infer<typeof resultsSchema>;

export const snapshotSchema = z.strictObject({
  type: z.literal('snapshot'),
  protocol: z.number().int(),
  serverNow: time,
  code: z.string(),
  phase: phaseSchema,
  config: versusConfigSchema,
  you: z.strictObject({
    playerId: playerId.optional(),
    /** Solo al unirse: el cliente lo guarda para recuperar su lugar. */
    token: z.string().optional(),
    spectator: z.boolean(),
  }),
  hostId: playerId,
  players: z.array(playerViewSchema),
  /** Solo para los jugadores y después de la sala de espera: con el índice da el día de cada partida. */
  seed: z.string().optional(),
  startsAt: time.optional(),
  progress: z.array(progressViewSchema),
  /** La partida propia en curso (la actual del jugador). */
  mine: z.strictObject({ index: z.number().int().min(0).max(99), status: gameStatus, startedAt: time.optional(), endsAt: time.optional() }).optional(),
  /** Las partidas de desempate que se agregaron (índices 11, 12…). */
  tiebreakGames: z.array(z.strictObject({ index, partida: partidaSchema })),
  tiebreak: tiebreakViewSchema.optional(),
  spin: spinViewSchema.optional(),
  results: resultsSchema.optional(),
  rematch: z.string().optional(),
});
export type Snapshot = z.infer<typeof snapshotSchema>;

export const serverMessageSchema = z.discriminatedUnion('type', [
  snapshotSchema,
  z.strictObject({ type: z.literal('players'), hostId: playerId, players: z.array(playerViewSchema) }),
  /** La cuenta regresiva: la hora de inicio común y la del servidor, para corregir el reloj. `seed` solo a los jugadores. */
  z.strictObject({ type: z.literal('countdown'), startsAt: time, serverNow: time, seed: z.string().optional() }),
  z.strictObject({ type: z.literal('lobby'), serverNow: time }),
  z.strictObject({ type: z.literal('progress'), progress: progressViewSchema }),
  /** La partida empezó para este jugador (a la hora `at`); en Contrarreloj, con su vencimiento. */
  z.strictObject({ type: z.literal('partidaStart'), index, at: time, endsAt: time.optional() }),
  /** Fin anticipado de Mayor o Menor: ya superó a todos los que terminaron. */
  z.strictObject({ type: z.literal('endNow'), index }),
  /** Se acabó el tiempo de esa partida para este jugador. */
  z.strictObject({ type: z.literal('timeUp'), index }),
  z.strictObject({ type: z.literal('tiebreak'), tiebreak: tiebreakViewSchema }),
  /** Cuántos votaron; al cerrar la votación, qué votó cada uno. */
  z.strictObject({
    type: z.literal('votes'),
    voted: z.number().int().min(0),
    total: z.number().int().min(0),
    votes: z.array(z.strictObject({ playerId, option: tiebreakVoteSchema })).optional(),
  }),
  z.strictObject({ type: z.literal('spin'), spin: spinViewSchema }),
  z.strictObject({ type: z.literal('tiebreakStart'), index, partida: partidaSchema, at: time }),
  z.strictObject({ type: z.literal('results'), results: resultsSchema }),
  /** La revancha: el código de la sala nueva (los que siguen conectados ya están en ella). */
  z.strictObject({ type: z.literal('rematch'), code: z.string() }),
  z.strictObject({ type: z.literal('error'), code: z.enum(ERROR_CODES), message: z.string().max(200).optional() }),
]);
export type ServerMessage = z.infer<typeof serverMessageSchema>;
export type ServerMessageOf<T extends ServerMessage['type']> = Extract<ServerMessage, { type: T }>;
export type PartidaStatusName = (typeof PARTIDA_STATUSES)[number];

// --- Parseo ------------------------------------------------------------------------------------------------------------

const encoder = new TextEncoder();

export type ParsedClient = { readonly ok: true; readonly message: ClientMessage } | { readonly ok: false; readonly error: 'too_large' | 'bad_message' };

/** El mensaje de un cliente: más de 2 KB se rechaza sin parsear; lo que no es JSON ni un mensaje válido, también. */
export function parseClientMessage(raw: unknown): ParsedClient {
  if (typeof raw !== 'string') return { ok: false, error: 'bad_message' };
  if (encoder.encode(raw).byteLength > MAX_MESSAGE_BYTES) return { ok: false, error: 'too_large' };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'bad_message' };
  }
  const result = clientMessageSchema.safeParse(json);
  return result.success ? { ok: true, message: result.data } : { ok: false, error: 'bad_message' };
}

/** El mensaje de un servidor, validado (el cliente no confía en lo que llega). `null` si no es válido. */
export function parseServerMessage(raw: unknown): ServerMessage | null {
  if (typeof raw !== 'string') return null;
  try {
    const result = serverMessageSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function encodeMessage(message: ServerMessage | ClientMessage): string {
  return JSON.stringify(message);
}
