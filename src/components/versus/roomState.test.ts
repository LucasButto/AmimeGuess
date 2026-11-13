import { describe, expect, it } from 'vitest';
import { DEFAULT_OPTIONS } from '@/versus/config';
import { PROTOCOL_VERSION, type ServerMessage, type Snapshot } from '@/versus/protocol';
import { applyMessage, countdownNumber, gameHref, noticeOf } from './roomState';

const snapshot: Snapshot = {
  type: 'snapshot',
  protocol: PROTOCOL_VERSION,
  serverNow: 1_000,
  code: 'K7P2QX',
  phase: 'lobby',
  config: { modality: 'race', partidas: [{ franchise: 'pokemon', mode: 'clasico', engine: 'classic', series: ['g1'] }], options: { ...DEFAULT_OPTIONS } },
  you: { playerId: 'p1', spectator: false },
  hostId: 'p1',
  players: [{ id: 'p1', name: 'Ana', ready: false, connected: true, abandoned: false }],
  progress: [],
  tiebreakGames: [],
};

describe('applyMessage', () => {
  it('el snapshot reemplaza todo; sin snapshot, el resto se ignora', () => {
    expect(applyMessage(null, snapshot)).toBe(snapshot);
    expect(applyMessage(null, { type: 'players', hostId: 'p1', players: [] })).toBeNull();
  });

  it('la lista de jugadores y el creador se actualizan', () => {
    const players = [...snapshot.players, { id: 'p2', name: 'Beto', ready: true, connected: true, abandoned: false }];
    const next = applyMessage(snapshot, { type: 'players', hostId: 'p2', players });
    expect(next).toMatchObject({ hostId: 'p2', players });
    expect(next?.config).toBe(snapshot.config);
  });

  it('la cuenta regresiva pasa la sala a `countdown` con su hora de inicio y su semilla', () => {
    const next = applyMessage(snapshot, { type: 'countdown', startsAt: 4_000, serverNow: 1_000, seed: 'abc' });
    expect(next).toMatchObject({ phase: 'countdown', startsAt: 4_000, seed: 'abc' });
    // Sin semilla (un espectador), no inventa una.
    expect(applyMessage(snapshot, { type: 'countdown', startsAt: 4_000, serverNow: 1_000 })?.seed).toBeUndefined();
  });

  it('si alguien se va y la cuenta se cancela, vuelve a la sala de espera sin hora de inicio', () => {
    const counting = applyMessage(snapshot, { type: 'countdown', startsAt: 4_000, serverNow: 1_000 });
    const back = applyMessage(counting, { type: 'lobby', serverNow: 2_000 });
    expect(back?.phase).toBe('lobby');
    expect(back?.startsAt).toBeUndefined();
  });

  it('el progreso de un jugador reemplaza el suyo o se agrega', () => {
    const first = { playerId: 'p1', index: 1, attempts: 2, status: 'playing' as const, done: 0 };
    const added = applyMessage(snapshot, { type: 'progress', progress: first });
    expect(added?.progress).toEqual([first]);
    const replaced = applyMessage(added, { type: 'progress', progress: { ...first, attempts: 3 } });
    expect(replaced?.progress).toEqual([{ ...first, attempts: 3 }]);
  });

  it('al empezar la partida la sala pasa a `playing` con la partida del jugador', () => {
    const counting = applyMessage(snapshot, { type: 'countdown', startsAt: 4_000, serverNow: 1_000, seed: 'abc' });
    const next = applyMessage(counting, { type: 'partidaStart', index: 1, at: 4_000, endsAt: 94_000 });
    expect(next).toMatchObject({ phase: 'playing', mine: { index: 1, status: 'playing', startedAt: 4_000, endsAt: 94_000 } });
    // Una partida siguiente no cambia la fase.
    expect(applyMessage(next, { type: 'partidaStart', index: 2, at: 9_000 })).toMatchObject({ phase: 'playing', mine: { index: 2 } });
  });

  it('el cierre de partida lo maneja la conexión: no cambia la vista', () => {
    const messages: ServerMessage[] = [{ type: 'endNow', index: 1 }, { type: 'timeUp', index: 1 }];
    for (const message of messages) expect(applyMessage(snapshot, message)).toBe(snapshot);
  });
  it('los votos cuentan cuántos votaron en la votación abierta', () => {
    const voting = applyMessage(snapshot, { type: 'tiebreak', tiebreak: { round: 1, players: ['p1', 'p2'], played: [], votingEndsAt: 30_000, voted: 0 } });
    const next = applyMessage(voting, { type: 'votes', voted: 1, total: 2 });
    expect(next).toMatchObject({ phase: 'tiebreakVote', tiebreak: { voted: 1 } });
    // Sin votación abierta no cambia nada.
    expect(applyMessage(snapshot, { type: 'votes', voted: 1, total: 2 })).toBe(snapshot);
  });

  it('la revancha guarda el código de la sala nueva', () => {
    expect(applyMessage(snapshot, { type: 'rematch', code: 'ABCD23' })).toMatchObject({ rematch: 'ABCD23' });
  });
});

describe('avisos y cuenta regresiva', () => {
  it('cada error que no se arregla reintentando tiene su aviso', () => {
    expect(noticeOf('room_full')).toBe('full');
    expect(noticeOf('already_started')).toBe('started');
    expect(noticeOf('kicked')).toBe('kicked');
    expect(noticeOf('room_closed')).toBe('closed');
    expect(noticeOf('protocol_mismatch')).toBe('mismatch');
    expect(noticeOf('bad_message')).toBeNull();
    expect(noticeOf('not_allowed')).toBeNull();
  });

  it('cuenta 3, 2, 1 y 0 con la hora del servidor', () => {
    expect(countdownNumber(4_000, 1_000)).toBe(3);
    expect(countdownNumber(4_000, 1_001)).toBe(3);
    expect(countdownNumber(4_000, 2_000)).toBe(2);
    expect(countdownNumber(4_000, 3_999)).toBe(1);
    expect(countdownNumber(4_000, 4_000)).toBe(0);
    expect(countdownNumber(4_000, 9_000)).toBe(0);
  });
});

describe('gameHref', () => {
  it('lleva a la página del modo con la sala y la partida', () => {
    expect(gameHref(snapshot, 1)).toBe('/pokemon/clasico?v=K7P2QX&p=1');
    expect(gameHref(snapshot, 2)).toBeNull();
  });

  it('las partidas de desempate siguen la numeración', () => {
    const withTiebreak = { ...snapshot, tiebreakGames: [{ index: 11, partida: { franchise: 'naruto', mode: 'silueta', engine: 'image-reveal' as const, series: ['naruto'] } }] };
    expect(gameHref(withTiebreak, 11)).toBe('/naruto/silueta?v=K7P2QX&p=11');
    expect(gameHref(withTiebreak, 12)).toBeNull();
  });
});
