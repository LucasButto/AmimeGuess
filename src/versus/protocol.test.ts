import { describe, expect, it } from 'vitest';
import type { Partida } from './config';
import { DEFAULT_OPTIONS } from './config';
import {
  MAX_MESSAGE_BYTES,
  PROTOCOL_VERSION,
  encodeMessage,
  parseClientMessage,
  parseServerMessage,
  type ClientMessage,
  type ServerMessage,
} from './protocol';

const partida: Partida = { franchise: 'pokemon', mode: 'clasico', engine: 'classic', series: ['g1'], timeLimitMs: 90_000 };
const answer = { label: 'Pikachu', imageStem: 'pokemon/25' };
const progress = { playerId: 'p1', index: 1, attempts: 2, status: 'playing' as const, done: 0 };

const validClient: ClientMessage[] = [
  { type: 'hello', protocol: PROTOCOL_VERSION },
  { type: 'hello', protocol: PROTOCOL_VERSION, name: 'Ana' },
  { type: 'ready', value: true },
  { type: 'start' },
  { type: 'kick', playerId: 'p2' },
  { type: 'loaded', index: 2 },
  { type: 'progress', index: 1, attempts: 3 },
  { type: 'progress', index: 1, attempts: 3, errors: 1, score: 7 },
  { type: 'finish', index: 1, won: true, attempts: 4, grid: ['🟩🟥🟩'], answer },
  { type: 'finish', index: 3, won: true, attempts: 3, scores: [450, 520, 610], grid: [], answer: { label: 'x' } },
  { type: 'surrender', index: 1 },
  { type: 'vote', option: { played: 2 } },
  { type: 'vote', option: { other: partida } },
  { type: 'leave' },
  { type: 'rematch' },
];

describe('mensajes del cliente', () => {
  for (const message of validClient) {
    it(`acepta ${message.type} ${JSON.stringify(message).slice(0, 40)}`, () => {
      expect(parseClientMessage(JSON.stringify(message))).toEqual({ ok: true, message });
    });
  }

  it('rechaza lo que no es JSON, lo que no es texto y los tipos que no existen', () => {
    expect(parseClientMessage('no es json')).toEqual({ ok: false, error: 'bad_message' });
    expect(parseClientMessage(new ArrayBuffer(4))).toEqual({ ok: false, error: 'bad_message' });
    expect(parseClientMessage(JSON.stringify({ type: 'fly' }))).toEqual({ ok: false, error: 'bad_message' });
    expect(parseClientMessage('null')).toEqual({ ok: false, error: 'bad_message' });
  });

  it('rechaza campos que faltan, de más o fuera de rango, de cada tipo', () => {
    const bad: unknown[] = [
      { type: 'hello' },
      { type: 'hello', protocol: '1' },
      { type: 'hello', protocol: 1, name: 'x'.repeat(65) },
      { type: 'ready' },
      { type: 'ready', value: 'si' },
      { type: 'start', extra: 1 },
      { type: 'kick' },
      { type: 'kick', playerId: '' },
      { type: 'loaded', index: 0 },
      { type: 'loaded' },
      { type: 'progress', index: 1 },
      { type: 'progress', index: 1, attempts: -1 },
      { type: 'progress', index: 1, attempts: 1.5 },
      { type: 'finish', index: 1, won: true, attempts: 1, grid: [], answer: { label: 'x'.repeat(201) } },
      { type: 'finish', index: 1, won: true, attempts: 1, answer },
      { type: 'finish', index: 1, won: true, attempts: 1, grid: Array.from({ length: 21 }, () => 'x'), answer },
      { type: 'surrender' },
      { type: 'vote' },
      { type: 'vote', option: { played: 0 } },
      { type: 'vote', option: { other: { franchise: 'pokemon' } } },
      { type: 'vote', option: { played: 1, other: partida } },
      { type: 'leave', now: 1 },
      { type: 'rematch', code: 'X' },
    ];
    for (const message of bad) expect(parseClientMessage(JSON.stringify(message)), JSON.stringify(message)).toEqual({ ok: false, error: 'bad_message' });
  });

  it('rechaza sin parsear un mensaje de más de 2 KB', () => {
    const big = JSON.stringify({ type: 'hello', protocol: 1, name: 'a'.repeat(MAX_MESSAGE_BYTES) });
    expect(parseClientMessage(big)).toEqual({ ok: false, error: 'too_large' });
    // Aunque no sea JSON: el tamaño se mira primero.
    expect(parseClientMessage('x'.repeat(MAX_MESSAGE_BYTES + 1))).toEqual({ ok: false, error: 'too_large' });
    // Justo en el límite todavía se acepta.
    const start = JSON.stringify({ type: 'start' });
    expect(parseClientMessage(start + ' '.repeat(MAX_MESSAGE_BYTES - start.length)).ok).toBe(true);
    expect(parseClientMessage(start + ' '.repeat(MAX_MESSAGE_BYTES - start.length + 1))).toEqual({ ok: false, error: 'too_large' });
  });

  it('el tamaño cuenta bytes y no caracteres (los emojis pesan 4)', () => {
    const grid = Array.from({ length: 3 }, () => '🟩'.repeat(10));
    const message = JSON.stringify({ type: 'finish', index: 1, won: true, attempts: 1, grid, answer });
    expect(new TextEncoder().encode(message).byteLength).toBeLessThan(MAX_MESSAGE_BYTES);
    expect(parseClientMessage(message).ok).toBe(true);
  });
});

const playerView = { id: 'p1', name: 'Ana', ready: true, connected: true, abandoned: false };
const options = { ...DEFAULT_OPTIONS };
const config = { modality: 'timeAttack' as const, partidas: [partida], options };
const spin = { options: [{ option: { played: 1 }, votes: 2 }, { option: { other: partida }, votes: 1 }], winner: 0, endsAt: 1_000 };
const tiebreak = { round: 1, players: ['p1', 'p2'], played: [{ index: 1, partida }], votingEndsAt: 5_000, voted: 0 };
const results = {
  modality: 'timeAttack' as const,
  table: [{ playerId: 'p1', place: 1, totalMs: 45_000 }],
  players: [{ id: 'p1', name: 'Ana' }],
  tiebreakWon: false,
  partidas: [{ index: 1, tiebreak: false, partida, ranking: [['p1']], games: [{ playerId: 'p1', status: 'solved' as const, elapsedMs: 45_000, answer }] }],
};

const validServer: ServerMessage[] = [
  {
    type: 'snapshot',
    protocol: PROTOCOL_VERSION,
    serverNow: 10,
    code: 'K7P2QX',
    phase: 'lobby',
    config,
    you: { playerId: 'p1', token: 'abc', spectator: false },
    hostId: 'p1',
    players: [playerView],
    progress: [],
    tiebreakGames: [],
  },
  { type: 'players', hostId: 'p1', players: [playerView] },
  { type: 'countdown', startsAt: 4_000, serverNow: 1_000, seed: 'abc' },
  { type: 'lobby', serverNow: 1_000 },
  { type: 'progress', progress },
  { type: 'partidaStart', index: 1, at: 1_000, endsAt: 91_000 },
  { type: 'endNow', index: 2 },
  { type: 'timeUp', index: 1 },
  { type: 'tiebreak', tiebreak },
  { type: 'votes', voted: 1, total: 2 },
  { type: 'votes', voted: 2, total: 2, votes: [{ playerId: 'p1', option: { played: 1 } }] },
  { type: 'spin', spin },
  { type: 'tiebreakStart', index: 11, partida, at: 9_000 },
  { type: 'results', results },
  { type: 'rematch', code: 'K7P2QX' },
  { type: 'error', code: 'room_full' },
  { type: 'error', code: 'protocol_mismatch', message: 'Actualizá la página' },
];

describe('mensajes del servidor', () => {
  for (const message of validServer) {
    it(`acepta ${message.type}`, () => {
      expect(parseServerMessage(encodeMessage(message))).toEqual(message);
    });
  }

  it('rechaza mensajes mal formados', () => {
    expect(parseServerMessage('x')).toBeNull();
    expect(parseServerMessage(JSON.stringify({ type: 'countdown', startsAt: 'ya' }))).toBeNull();
    expect(parseServerMessage(JSON.stringify({ type: 'error', code: 'explotó' }))).toBeNull();
    expect(parseServerMessage(JSON.stringify({ type: 'progress', progress: { ...progress, status: 'raro' } }))).toBeNull();
    expect(parseServerMessage(JSON.stringify({ type: 'results', results: { ...results, modality: 'solo' } }))).toBeNull();
    expect(parseServerMessage(new ArrayBuffer(2))).toBeNull();
  });

  it('el progreso de los rivales no tiene dónde llevar sus intentos', () => {
    const leaky = { type: 'progress', progress: { ...progress, attempts: 2, grid: ['🟩'], names: ['Pikachu'] } };
    expect(parseServerMessage(JSON.stringify(leaky))).toBeNull();
  });
});
