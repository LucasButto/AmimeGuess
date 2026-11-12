import { describe, expect, it } from 'vitest';
import { fnv1a32 } from '../../src/engine/hash';
import { parseConfig, type VersusConfig } from '../../src/versus/config';
import { PROTOCOL_VERSION, parseServerMessage, type ClientMessage, type ServerMessage } from '../../src/versus/protocol';
import { FINISHED_TTL_MS, RECONNECT_MS, type RoomState } from '../../src/versus/room';
import { MAX_MESSAGES_PER_SECOND, RoomHost, type HostPlatform, type HostSocket } from '../src/host';

// El anfitrión de la sala con una plataforma falsa: guardado, alarma única, reparto de mensajes, hibernación, borrado a las
// 24 horas y revancha, sin Cloudflare.

const clasico = { franchise: 'pokemon', mode: 'clasico', engine: 'classic', series: ['g1'] };
const race = (): VersusConfig => {
  const parsed = parseConfig({ modality: 'race', partidas: [clasico] });
  if (!parsed.ok) throw new Error(parsed.errors.join(';'));
  return parsed.config;
};

class FakeRoom {
  now = 1_000_000;
  stored: string | null = null;
  alarm: number | null = null;
  alarmCalls: (number | null)[] = [];
  wiped = false;
  entropyCount = 0;
  codes = ['ABCD23', 'EFGH45'];
  adoptable = true;
  adopted: { code: string; state: RoomState }[] = [];
  logs: string[] = [];
  sockets = new Map<string, { sent: string[]; closed: string | null }>();

  platform: HostPlatform = {
    now: () => this.now,
    entropy: () => {
      const n = this.entropyCount++;
      return Array.from({ length: 8 }, (_, i) => fnv1a32(`${n}:${i}`).toString(16).padStart(8, '0')).join('');
    },
    newCode: () => this.codes.shift() ?? 'ZZZZ22',
    load: () => (this.stored ? (JSON.parse(this.stored) as RoomState) : null),
    save: (state) => {
      this.stored = JSON.stringify(state);
    },
    wipe: async () => {
      this.stored = null;
      this.alarm = null;
      this.wiped = true;
    },
    getAlarm: async () => this.alarm,
    setAlarm: async (at) => {
      this.alarm = at;
      this.alarmCalls.push(at);
    },
    deleteAlarm: async () => {
      this.alarm = null;
      this.alarmCalls.push(null);
    },
    sockets: () => [...this.sockets.entries()].map(([conn, socket]): HostSocket => ({ conn, send: (text) => void socket.sent.push(text), close: (_code, reason) => void (socket.closed = reason) })),
    createRoom: async (code, state) => {
      if (!this.adoptable) return false;
      this.adopted.push({ code, state });
      return true;
    },
    log: (event) => void this.logs.push(event),
  };

  host = new RoomHost(this.platform);

  /** Lo mismo que cuando el objeto despierta de la hibernación: otro anfitrión sobre el mismo almacenamiento. */
  hibernate(): void {
    this.host = new RoomHost(this.platform);
  }

  open(conn: string): void {
    this.sockets.set(conn, { sent: [], closed: null });
  }

  async connect(conn: string, token: string | null = null, name?: string): Promise<void> {
    this.open(conn);
    await this.host.connect(conn, token);
    await this.send(conn, { type: 'hello', protocol: PROTOCOL_VERSION, ...(name ? { name } : {}) });
  }

  send(conn: string, message: ClientMessage): Promise<void> {
    return this.host.message(conn, JSON.stringify(message));
  }

  received(conn: string): ServerMessage[] {
    return (this.sockets.get(conn)?.sent ?? []).map((text) => parseServerMessage(text)!);
  }

  types(conn: string): string[] {
    return this.received(conn).map((message) => message.type);
  }
}

async function created(): Promise<{ room: FakeRoom; token: string; playerId: string }> {
  const room = new FakeRoom();
  const result = await room.host.create({ code: 'K7P2QX', config: race(), name: 'Ana' });
  if (!result.ok) throw new Error('no se creó');
  return { room, token: result.token, playerId: result.playerId };
}

/** Una sala de Carrera de 1 partida con Ana y Beto, empezada. */
async function started() {
  const { room, token } = await created();
  await room.connect('A', token);
  await room.connect('B', null, 'Beto');
  await room.send('A', { type: 'ready', value: true });
  await room.send('B', { type: 'ready', value: true });
  await room.send('A', { type: 'start' });
  room.now = (room.platform.load() as RoomState).startsAt!;
  await room.host.alarm();
  return room;
}

describe('crear la sala', () => {
  it('guarda la sala y deja una sola alarma, al vencimiento más cercano', async () => {
    const { room } = await created();
    expect(room.platform.load()).toMatchObject({ code: 'K7P2QX', phase: 'lobby' });
    // El creador todavía no se conectó: su espera de 2 minutos vence antes que la de inactividad (1 hora).
    expect(room.alarm).toBe(1_000_000 + RECONNECT_MS);
    expect(room.alarmCalls).toEqual([1_000_000 + RECONNECT_MS]);
    expect(room.logs).toEqual(['room_created']);
  });

  it('no se crea dos veces', async () => {
    const { room } = await created();
    expect(await room.host.create({ code: 'K7P2QX', config: race(), name: 'Otro' })).toEqual({ ok: false, reason: 'exists' });
  });

  it('el creador entra con su token y recibe su snapshot; la alarma pasa al vencimiento siguiente', async () => {
    const { room, token, playerId } = await created();
    await room.connect('A', token);
    const snapshot = room.received('A').find((message) => message.type === 'snapshot');
    expect(snapshot).toMatchObject({ you: { playerId, spectator: false }, phase: 'lobby' });
    // Ya conectado, solo queda la inactividad de la sala de espera.
    expect(room.alarm).toBe(1_000_000 + 3_600_000);
  });
});

describe('la alarma', () => {
  it('se reprograma solo cuando cambia: una sola alarma, siempre la más cercana', async () => {
    const room = await started();
    const calls = room.alarmCalls.length;
    // Progresos que no cambian ningún vencimiento no tocan la alarma.
    await room.send('A', { type: 'progress', index: 1, attempts: 1 });
    await room.send('A', { type: 'progress', index: 1, attempts: 2 });
    expect(room.alarmCalls).toHaveLength(calls);
    const state = room.platform.load() as RoomState;
    expect(state.phase).toBe('playing');
    // Carrera: no hay tiempo límite, así que no queda ninguna alarma pendiente.
    expect(room.alarm).toBeNull();
  });

  it('la cuenta regresiva programa su vencimiento y, al vencer, empieza la partida', async () => {
    const { room, token } = await created();
    await room.connect('A', token);
    await room.connect('B', null, 'Beto');
    await room.send('A', { type: 'ready', value: true });
    await room.send('B', { type: 'ready', value: true });
    await room.send('A', { type: 'start' });
    const startsAt = (room.platform.load() as RoomState).startsAt!;
    expect(room.alarm).toBe(startsAt);
    room.now = startsAt;
    await room.host.alarm();
    expect(room.types('A')).toContain('partidaStart');
    expect(room.logs).toContain('room_started');
  });

  it('una sala terminada se borra a las 24 horas: alarma probada con tiempo falso', async () => {
    const room = await started();
    await room.send('A', { type: 'finish', index: 1, won: true, attempts: 2, grid: [], answer: { label: 'x' } });
    // En Carrera, llegar en el mismo instante es empate: se separan por un segundo.
    room.now += 1_000;
    await room.send('B', { type: 'finish', index: 1, won: true, attempts: 3, grid: [], answer: { label: 'x' } });
    const state = room.platform.load() as RoomState;
    expect(state.phase).toBe('finished');
    expect(room.logs).toContain('room_finished');
    expect(room.alarm).toBe(state.finishedAt! + FINISHED_TTL_MS);
    room.now = state.finishedAt! + FINISHED_TTL_MS - 1;
    await room.host.alarm();
    expect(room.wiped).toBe(false);
    room.now = state.finishedAt! + FINISHED_TTL_MS;
    await room.host.alarm();
    expect(room.wiped).toBe(true);
    expect(room.host.exists()).toBe(false);
    expect(room.platform.load()).toBeNull();
    expect(room.alarm).toBeNull();
    expect(room.logs).toContain('room_destroyed');
    // Las conexiones que quedaban se cierran.
    expect(room.sockets.get('A')!.closed).toBe('room_closed');
  });
});

describe('hibernación', () => {
  it('al despertar, otro anfitrión sigue la sala desde lo guardado', async () => {
    const room = await started();
    await room.send('A', { type: 'progress', index: 1, attempts: 3 });
    room.hibernate();
    expect(room.host.exists()).toBe(true);
    await room.send('A', { type: 'finish', index: 1, won: true, attempts: 4, grid: [], answer: { label: 'x' } });
    room.now += 1_000;
    await room.send('B', { type: 'finish', index: 1, won: true, attempts: 4, grid: [], answer: { label: 'x' } });
    expect((room.platform.load() as RoomState).phase).toBe('finished');
  });

  it('despierta con la alarma pendiente guardada y no la repite', async () => {
    const { room } = await created();
    const calls = room.alarmCalls.length;
    room.hibernate();
    await room.host.connect('X', null);
    // El vencimiento no cambió: no hace falta volver a programar nada.
    expect(room.alarmCalls).toHaveLength(calls);
  });
});

describe('reparto de mensajes', () => {
  it('cada uno recibe lo suyo: el que se une, su snapshot con su token; los demás, la lista de jugadores', async () => {
    const { room, token } = await created();
    await room.connect('A', token);
    await room.connect('B', null, 'Beto');
    const joined = room.received('B').find((message) => message.type === 'snapshot');
    expect(joined).toMatchObject({ you: { spectator: false, token: expect.any(String) } });
    expect(room.types('A')).toContain('players');
    // El token de Beto no llega a nadie más.
    expect(JSON.stringify(room.received('A'))).not.toContain((joined as { you: { token: string } }).you.token);
  });

  it('un espectador no recibe la semilla ni el progreso con intentos; los jugadores sí la reciben al empezar', async () => {
    const { room, token } = await created();
    await room.connect('A', token);
    await room.connect('B', null, 'Beto');
    await room.connect('S');
    await room.send('A', { type: 'ready', value: true });
    await room.send('B', { type: 'ready', value: true });
    await room.send('A', { type: 'start' });
    const seed = (room.platform.load() as RoomState).seed;
    expect(JSON.stringify(room.received('S'))).not.toContain(seed);
    expect(JSON.stringify(room.received('A'))).toContain(seed);
  });

  it('salir cierra las conexiones del jugador', async () => {
    const { room, token } = await created();
    await room.connect('A', token);
    await room.connect('B', null, 'Beto');
    await room.send('B', { type: 'leave' });
    expect(room.sockets.get('B')!.closed).toBe('bye');
    expect(room.sockets.get('A')!.closed).toBeNull();
  });
});

describe('mensajes de más', () => {
  it('uno de más de 2 KB, que no es JSON o que no es un mensaje: error y la sala sigue igual', async () => {
    const { room, token } = await created();
    await room.connect('A', token);
    const before = room.platform.load();
    await room.host.message('A', 'x'.repeat(2049));
    await room.host.message('A', 'no es json');
    await room.host.message('A', JSON.stringify({ type: 'fly' }));
    await room.host.message('A', new ArrayBuffer(8));
    const codes = room.received('A').flatMap((message) => (message.type === 'error' ? [message.code] : []));
    expect(codes).toEqual(['too_large', 'bad_message', 'bad_message', 'bad_message']);
    expect(room.platform.load()).toEqual(before);
  });

  it('más de 20 mensajes por segundo por conexión: los de más se descartan; con el tiempo vuelve a aceptar', async () => {
    const { room, token } = await created();
    await room.connect('A', token);
    const sent = () => room.received('A').filter((message) => message.type === 'players').length;
    const before = sent();
    for (let i = 0; i < MAX_MESSAGES_PER_SECOND + 15; i++) await room.send('A', { type: 'ready', value: i % 2 === 0 });
    // Hubo 1 hello antes: pasan 19 de los 35 mensajes en el mismo instante.
    expect(sent() - before).toBeLessThan(MAX_MESSAGES_PER_SECOND + 15);
    expect(sent() - before).toBeLessThanOrEqual(MAX_MESSAGES_PER_SECOND);
    room.now += 1_000;
    const again = sent();
    await room.send('A', { type: 'ready', value: true });
    expect(sent()).toBe(again + 1);
  });
});

describe('desconexión', () => {
  it('al cerrarse la conexión marca al jugador desconectado y programa los 2 minutos', async () => {
    const { room, token } = await created();
    await room.connect('A', token);
    await room.connect('B', null, 'Beto');
    await room.host.disconnect('B');
    const state = room.platform.load() as RoomState;
    expect(state.players.find((player) => player.name === 'Beto')!.disconnectedAt).toBe(room.now);
    expect(room.alarm).toBe(room.now + RECONNECT_MS);
    room.now += RECONNECT_MS;
    await room.host.alarm();
    expect((room.platform.load() as RoomState).players.map((player) => player.name)).toEqual(['Ana']);
  });
});

describe('revancha', () => {
  async function finishedRoom() {
    const room = await started();
    await room.send('A', { type: 'finish', index: 1, won: true, attempts: 2, grid: [], answer: { label: 'x' } });
    // En Carrera, llegar en el mismo instante es empate: se separan por un segundo.
    room.now += 1_000;
    await room.send('B', { type: 'finish', index: 1, won: true, attempts: 3, grid: [], answer: { label: 'x' } });
    return room;
  }

  it('crea la sala nueva primero y recién después avisa a todos', async () => {
    const room = await finishedRoom();
    await room.send('A', { type: 'rematch' });
    expect(room.adopted).toHaveLength(1);
    expect(room.adopted[0].code).toBe('ABCD23');
    expect(room.adopted[0].state.phase).toBe('lobby');
    for (const conn of ['A', 'B']) expect(room.received(conn).filter((message) => message.type === 'rematch')).toEqual([{ type: 'rematch', code: 'ABCD23' }]);
  });

  it('si no se puede crear la sala nueva, no se avisa de nada y el creador puede reintentar con otro código', async () => {
    const room = await finishedRoom();
    room.adoptable = false;
    await room.send('A', { type: 'rematch' });
    expect(room.types('A')).not.toContain('rematch');
    expect(room.received('A').filter((message) => message.type === 'error').at(-1)).toMatchObject({ code: 'not_allowed' });
    expect((room.platform.load() as RoomState).rematch).toBeUndefined();
    room.adoptable = true;
    await room.send('A', { type: 'rematch' });
    expect(room.adopted.at(-1)!.code).toBe('EFGH45');
  });

  it('una sala armada afuera se adopta una sola vez', async () => {
    const room = await finishedRoom();
    await room.send('A', { type: 'rematch' });
    const fresh = new FakeRoom();
    expect(await fresh.host.adopt(room.adopted[0].state)).toBe(true);
    expect(await fresh.host.adopt(room.adopted[0].state)).toBe(false);
    expect(fresh.host.summary()).toMatchObject({ code: 'ABCD23', phase: 'lobby' });
  });
});

describe('resumen público', () => {
  it('sin sala no hay resumen; con sala, lo que ve un espectador (sin semilla ni tokens)', async () => {
    const empty = new FakeRoom();
    expect(empty.host.summary()).toBeNull();
    expect(empty.host.exists()).toBe(false);
    const room = await started();
    const summary = room.host.summary()!;
    expect(summary).toMatchObject({ code: 'K7P2QX', phase: 'playing', you: { spectator: true } });
    expect(summary.seed).toBeUndefined();
    expect(JSON.stringify(summary)).not.toContain((room.platform.load() as RoomState).players[0].token);
  });
});
