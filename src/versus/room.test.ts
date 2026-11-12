import { describe, expect, it } from 'vitest';
import { fnv1a32 } from '../engine/hash';
import { parseConfig, type Modality, type Partida, type VersusConfig, type VersusOptions } from './config';
import { PROTOCOL_VERSION, type ClientMessage, type ServerMessage, type ServerMessageOf } from './protocol';
import {
  COUNTDOWN_MS,
  FINISHED_TTL_MS,
  LOAD_GRACE_MS,
  LOBBY_IDLE_MS,
  RECONNECT_MS,
  SPIN_MS,
  TIEBREAK_FIRST_INDEX,
  VOTE_MS,
  createRoom,
  reduce,
  resolveTarget,
  snapshotFor,
  timersOf,
  type Effect,
  type RoomEvent,
  type RoomOutput,
  type RoomState,
} from './room';

// El reductor de la sala sin Cloudflare: una sala completa de cada modalidad con 2 y con 4 jugadores, el tiempo agotado, el
// desempate, las reconexiones, los abandonos, el espectador y la revancha (docs/versus/04-fase-2-servidor.md, paso 2.2).

const entropyOf = (n: number): string => Array.from({ length: 8 }, (_, i) => fnv1a32(`${n}:${i}`).toString(16).padStart(8, '0')).join('');

const clasico: Partida = { franchise: 'pokemon', mode: 'clasico', engine: 'classic', series: ['g1'] };
const silueta: Partida = { franchise: 'naruto', mode: 'silueta', engine: 'image-reveal', series: ['naruto'] };
const poder: Partida = { franchise: 'dragon-ball', mode: 'poder', engine: 'higher-lower', series: ['db'] };
const withLimit = (partida: Partida, timeLimitMs: number): Partida => ({ ...partida, timeLimitMs, defaultTimeLimitMs: timeLimitMs });

function config(modality: Modality, partidas: Partida[], options: Partial<VersusOptions> = {}): VersusConfig {
  const parsed = parseConfig({ modality, partidas, options });
  if (!parsed.ok) throw new Error(parsed.errors.join('; '));
  return parsed.config;
}

const START = 1_000_000;

/** Un evento sin el azar (el simulador lo pone). */
type EventInput = RoomEvent extends infer E ? (E extends unknown ? Omit<E, 'entropy'> & { entropy?: string } : never) : never;

/** Una sala simulada: lleva el reloj, el estado y lo que recibió cada conexión. */
class Sim {
  state: RoomState;
  now = START;
  seq = 1;
  inbox = new Map<string, ServerMessage[]>();
  closed: string[] = [];
  effects: Effect[] = [];
  destroyed = false;
  last!: RoomOutput;
  tokens = new Map<string, string>();
  ids = new Map<string, string>();

  constructor(cfg: VersusConfig, host = 'Ana') {
    const { state, playerId, token } = createRoom({ code: 'K7P2QX', config: cfg, name: host, entropy: entropyOf(0), now: this.now });
    this.state = state;
    this.tokens.set(host, token);
    this.ids.set(host, playerId);
  }

  /** Corre un evento a la hora actual y reparte lo que salió a las bandejas. */
  run(event: EventInput): RoomOutput {
    const full = { ...event, entropy: event.entropy ?? entropyOf(1_000 + this.seq++) } as RoomEvent;
    const output = reduce(this.state, full, this.now);
    // Los mensajes se reparten con el estado de antes (las conexiones que se cierran todavía están) y con el de después.
    for (const { target, message } of output.send) {
      const conns = new Set([...resolveTarget(this.state, target), ...resolveTarget(output.state, target)]);
      for (const conn of conns) this.inbox.set(conn, [...(this.inbox.get(conn) ?? []), message]);
    }
    this.state = output.state;
    this.closed.push(...output.close);
    this.effects.push(...output.effects);
    this.destroyed ||= output.destroy;
    this.last = output;
    return output;
  }

  /** Conecta a alguien. Con `name` se une; con el nombre del anfitrión, recupera su lugar; sin nada, mira. */
  connect(conn: string, who?: { name?: string; token?: string }): string {
    this.run({ type: 'connect', conn, ...(who?.token ? { token: who.token } : {}) });
    this.send(conn, { type: 'hello', protocol: PROTOCOL_VERSION, ...(who?.name ? { name: who.name } : {}) });
    const snapshot = this.of(conn, 'snapshot').at(-1);
    if (snapshot?.you.playerId && who?.name) {
      this.ids.set(who.name, snapshot.you.playerId);
      if (snapshot.you.token) this.tokens.set(who.name, snapshot.you.token);
    }
    return conn;
  }

  send(conn: string, message: ClientMessage, extra: { newCode?: string } = {}): RoomOutput {
    return this.run({ type: 'message', conn, message, ...extra });
  }

  /** Fija la hora (a `offsetFromStart` del inicio común) sin correr la alarma: los vencimientos corren al llegar el próximo evento. */
  at(offsetFromStart: number): this {
    this.now = (this.state.startsAt ?? 0) + offsetFromStart;
    return this;
  }

  /** Lo mismo, pero deja que corra la alarma (como hace el objeto al llegar la hora). */
  fire(offsetFromStart: number): this {
    return this.goto((this.state.startsAt ?? 0) + offsetFromStart);
  }

  /** Avanza el reloj y deja que corra la alarma (el objeto la programa al vencimiento más cercano). */
  goto(time: number): this {
    this.now = time;
    this.run({ type: 'alarm' });
    return this;
  }

  of<T extends ServerMessage['type']>(conn: string, type: T): ServerMessageOf<T>[] {
    return (this.inbox.get(conn) ?? []).filter((message): message is ServerMessageOf<T> => message.type === type);
  }

  errors(conn: string): string[] {
    return this.of(conn, 'error').map((message) => message.code);
  }

  id(name: string): string {
    return this.ids.get(name)!;
  }

  player(name: string) {
    return this.state.players.find((candidate) => candidate.name === name)!;
  }

  results() {
    const results = this.of('A', 'results').at(-1) ?? this.of(Object.keys(Object.fromEntries(this.inbox))[0], 'results').at(-1);
    return results!.results;
  }
}

/** La sala con los jugadores conectados (la conexión de cada uno se llama como su apodo, en mayúscula inicial) y lista. */
function lobby(cfg: VersusConfig, names: string[] = ['Ana', 'Beto']): Sim {
  const sim = new Sim(cfg, names[0]);
  sim.connect('A', { token: sim.tokens.get(names[0]), name: undefined });
  names.slice(1).forEach((name, index) => sim.connect(String.fromCharCode(66 + index), { name }));
  return sim;
}

/** Los jugadores marcan Listo, el anfitrión empieza y pasa la cuenta regresiva. */
function begin(sim: Sim): void {
  const conns = Object.keys(sim.state.conns);
  for (const conn of conns) sim.send(conn, { type: 'ready', value: true });
  sim.send('A', { type: 'start' });
  sim.goto(sim.state.startsAt!);
}

const finishMsg = (index: number, won = true, extra: Partial<Extract<ClientMessage, { type: 'finish' }>> = {}): ClientMessage => ({
  type: 'finish',
  index,
  won,
  attempts: 3,
  grid: ['🟩🟥'],
  answer: { label: `Respuesta ${index}` },
  ...extra,
});

describe('sala de espera', () => {
  it('el creador entra con su token y los demás con un apodo; cada uno recibe su snapshot', () => {
    const sim = lobby(config('timeAttack', [withLimit(clasico, 60_000)]));
    const host = sim.of('A', 'snapshot').at(-1)!;
    expect(host).toMatchObject({ code: 'K7P2QX', phase: 'lobby', you: { playerId: sim.id('Ana'), spectator: false }, hostId: sim.id('Ana') });
    expect(host.you.token).toBeUndefined();
    const guest = sim.of('B', 'snapshot').at(-1)!;
    expect(guest.you).toMatchObject({ spectator: false, token: sim.tokens.get('Beto') });
    expect(sim.state.players.map((player) => player.name)).toEqual(['Ana', 'Beto']);
    // Nadie ve el token de otro ni la semilla antes de empezar.
    expect(JSON.stringify(sim.of('A', 'players'))).not.toContain(sim.tokens.get('Beto'));
    expect(host.seed).toBeUndefined();
  });

  it('un protocolo distinto recibe protocol_mismatch y se cierra la conexión', () => {
    const sim = lobby(config('race', [clasico]));
    sim.run({ type: 'connect', conn: 'X' });
    sim.send('X', { type: 'hello', protocol: PROTOCOL_VERSION + 1, name: 'Zoe' });
    expect(sim.errors('X')).toEqual(['protocol_mismatch']);
    expect(sim.closed).toContain('X');
    expect(sim.state.conns.X).toBeUndefined();
  });

  it('start: solo el creador y con 2 o más listos', () => {
    const sim = lobby(config('race', [clasico]));
    sim.send('B', { type: 'start' });
    expect(sim.errors('B')).toEqual(['not_host']);
    sim.send('A', { type: 'start' });
    expect(sim.errors('A')).toEqual(['not_allowed']);
    sim.send('A', { type: 'ready', value: true });
    sim.send('A', { type: 'start' });
    expect(sim.errors('A')).toEqual(['not_allowed', 'not_allowed']);
    sim.send('B', { type: 'ready', value: true });
    sim.send('A', { type: 'start' });
    expect(sim.state.phase).toBe('countdown');
    expect(sim.of('A', 'countdown')[0]).toMatchObject({ startsAt: START + COUNTDOWN_MS, serverNow: START, seed: sim.state.seed });
    expect(sim.state.startsAt).toBe(START + COUNTDOWN_MS);
  });

  it('sala llena y sala empezada: error y quedan como espectadores, sin la semilla', () => {
    const sim = lobby(config('race', [clasico]), ['Ana', 'Beto']);
    for (let i = 0; i < 8; i++) sim.connect(`J${i}`, { name: `Jug${i}` });
    expect(sim.state.players).toHaveLength(10);
    sim.connect('Z', { name: 'Zoe' });
    expect(sim.errors('Z')).toEqual(['room_full']);
    expect(sim.of('Z', 'snapshot').at(-1)!.you.spectator).toBe(true);
    expect(sim.state.players).toHaveLength(10);
    begin(sim);
    sim.connect('Y', { name: 'Yago' });
    expect(sim.errors('Y')).toEqual(['already_started']);
    expect(sim.of('Y', 'snapshot').at(-1)).toMatchObject({ you: { spectator: true }, phase: 'playing' });
    expect(sim.of('Y', 'snapshot').at(-1)!.seed).toBeUndefined();
    // Los jugadores sí la reciben.
    expect(sim.of('A', 'countdown')[0].seed).toBe(sim.state.seed);
  });

  it('un apodo inválido se rechaza sin unirse', () => {
    const sim = lobby(config('race', [clasico]));
    sim.connect('X', { name: 'a'.repeat(17) });
    expect(sim.errors('X')).toEqual(['bad_message']);
    expect(sim.state.players).toHaveLength(2);
  });

  it('el espectador mira y no puede jugar', () => {
    const sim = lobby(config('timeAttack', [withLimit(clasico, 60_000)]));
    sim.connect('S');
    expect(sim.of('S', 'snapshot').at(-1)!.you.spectator).toBe(true);
    sim.send('S', { type: 'ready', value: true });
    sim.send('S', { type: 'start' });
    expect(sim.errors('S')).toEqual(['not_allowed', 'not_allowed']);
    begin(sim);
    sim.send('S', { type: 'progress', index: 1, attempts: 1 });
    expect(sim.errors('S').at(-1)).toBe('not_allowed');
    // Ve el progreso de todos y el final.
    sim.at(10_000).send('A', { type: 'progress', index: 1, attempts: 2 });
    expect(sim.of('S', 'progress').at(-1)!.progress).toMatchObject({ playerId: sim.id('Ana'), attempts: 2 });
  });

  it('el creador se va antes de empezar: la corona pasa al que entró después', () => {
    const sim = lobby(config('race', [clasico]), ['Ana', 'Beto', 'Caro']);
    sim.send('A', { type: 'leave' });
    expect(sim.state.hostId).toBe(sim.id('Beto'));
    expect(sim.state.players.map((player) => player.name)).toEqual(['Beto', 'Caro']);
    expect(sim.closed).toContain('A');
    sim.send('B', { type: 'leave' });
    expect(sim.state.hostId).toBe(sim.id('Caro'));
    // Si era el último de la lista, pasa al primero.
    sim.connect('D', { name: 'Dani' });
    sim.send('C', { type: 'leave' });
    expect(sim.state.hostId).toBe(sim.id('Dani'));
  });

  it('el creador saca a alguien; no puede sacarse ni sacar en otra fase', () => {
    const sim = lobby(config('race', [clasico]), ['Ana', 'Beto', 'Caro']);
    sim.send('B', { type: 'kick', playerId: sim.id('Caro') });
    expect(sim.errors('B')).toEqual(['not_host']);
    sim.send('A', { type: 'kick', playerId: sim.id('Ana') });
    expect(sim.errors('A')).toEqual(['not_allowed']);
    sim.send('A', { type: 'kick', playerId: sim.id('Caro') });
    expect(sim.errors('C')).toEqual(['kicked']);
    expect(sim.closed).toContain('C');
    expect(sim.state.players.map((player) => player.name)).toEqual(['Ana', 'Beto']);
  });

  it('una sala sin jugadores o sin actividad se borra', () => {
    const sim = lobby(config('race', [clasico]), ['Ana']);
    sim.send('A', { type: 'leave' });
    expect(sim.destroyed).toBe(true);
    const idle = lobby(config('race', [clasico]));
    idle.goto(START + LOBBY_IDLE_MS - 1);
    expect(idle.destroyed).toBe(false);
    idle.goto(START + LOBBY_IDLE_MS);
    expect(idle.destroyed).toBe(true);
  });

  it('el creador que nunca se conecta se va a los 2 minutos y la sala se borra', () => {
    const sim = new Sim(config('race', [clasico]));
    expect(timersOf(sim.state).map((timer) => timer.kind)).toEqual(['reconnect', 'idle']);
    sim.goto(START + RECONNECT_MS);
    expect(sim.destroyed).toBe(true);
  });
});

describe('Contrarreloj', () => {
  const partidas = [withLimit(clasico, 60_000), withLimit(silueta, 90_000)];

  it('2 jugadores, 2 partidas: gana el menor tiempo total y cuenta cada partida', () => {
    const sim = lobby(config('timeAttack', partidas));
    begin(sim);
    expect(sim.of('A', 'partidaStart')[0]).toEqual({ type: 'partidaStart', index: 1, at: sim.state.startsAt, endsAt: sim.state.startsAt! + 60_000 });
    sim.at(30_000).send('A', finishMsg(1));
    sim.at(31_000).send('A', { type: 'loaded', index: 2 });
    sim.at(50_000).send('B', finishMsg(1));
    sim.at(51_000).send('B', { type: 'loaded', index: 2 });
    sim.at(71_000).send('B', finishMsg(2));
    sim.at(76_000).send('A', finishMsg(2));
    expect(sim.state.phase).toBe('finished');
    const results = sim.results();
    expect(results.table).toEqual([
      { playerId: sim.id('Beto'), place: 1, totalMs: 70_000 },
      { playerId: sim.id('Ana'), place: 2, totalMs: 75_000 },
    ]);
    expect(results.tiebreakWon).toBe(false);
    // Recién acá aparecen las respuestas y las grillas.
    expect(results.partidas[0].games.find((game) => game.playerId === sim.id('Ana'))).toMatchObject({ status: 'solved', elapsedMs: 30_000, grid: ['🟩🟥'], answer: { label: 'Respuesta 1' } });
    expect(JSON.stringify(sim.of('B', 'progress'))).not.toContain('Respuesta');
  });

  it('el tiempo de las partidas siguientes corre desde el aviso `loaded`, no desde el final de la anterior', () => {
    const sim = lobby(config('timeAttack', partidas));
    begin(sim);
    sim.at(10_000).send('A', finishMsg(1));
    // Tarda 20 s en cargar la imagen: no cuenta.
    sim.at(30_000).send('A', { type: 'loaded', index: 2 });
    expect(sim.of('A', 'partidaStart').at(-1)).toEqual({ type: 'partidaStart', index: 2, at: sim.state.startsAt! + 30_000, endsAt: sim.state.startsAt! + 30_000 + 90_000 });
    sim.at(40_000).send('A', finishMsg(2));
    expect(sim.player('Ana').games.map((game) => game.elapsedMs)).toEqual([10_000, 10_000]);
  });

  it('si el aviso `loaded` no llega, la partida empieza sola a los 30 s', () => {
    const sim = lobby(config('timeAttack', partidas));
    begin(sim);
    sim.at(10_000).send('A', finishMsg(1));
    expect(sim.player('Ana').games[1].status).toBe('pending');
    sim.fire(10_000 + LOAD_GRACE_MS);
    expect(sim.player('Ana').games[1]).toMatchObject({ status: 'playing', startedAt: sim.state.startsAt! + 10_000 + LOAD_GRACE_MS });
  });

  it('tiempo agotado: la alarma cierra la partida con el límite completo, avisa timeUp y un finish tardío se ignora', () => {
    const sim = lobby(config('timeAttack', [withLimit(clasico, 60_000)]));
    begin(sim);
    sim.at(20_000).send('B', finishMsg(1));
    // La alarma vence a los 60 s exactos.
    sim.fire(60_000);
    expect(sim.of('A', 'timeUp')).toEqual([{ type: 'timeUp', index: 1 }]);
    expect(sim.of('B', 'timeUp')).toEqual([]);
    expect(sim.player('Ana').games[0]).toMatchObject({ status: 'timeUp', elapsedMs: 60_000 });
    // El aviso de fin que llega después (1 s tarde) no cambia nada: solo suma la respuesta para el final.
    sim.at(61_000).send('A', finishMsg(1));
    expect(sim.errors('A')).toEqual([]);
    expect(sim.player('Ana').games[0]).toMatchObject({ status: 'timeUp', answer: { label: 'Respuesta 1' } });
    expect(sim.results().table).toEqual([
      { playerId: sim.id('Beto'), place: 1, totalMs: 20_000 },
      { playerId: sim.id('Ana'), place: 2, totalMs: 60_000 },
    ]);
  });

  it('un finish que llega antes de la hora límite vale, aunque la alarma se dispare en el mismo instante', () => {
    const sim = lobby(config('timeAttack', [withLimit(clasico, 60_000)]));
    begin(sim);
    sim.at(59_999).send('A', finishMsg(1));
    expect(sim.player('Ana').games[0]).toMatchObject({ status: 'solved', elapsedMs: 59_999 });
    // Justo en la hora límite también vale (la alarma corre después del mensaje).
    sim.at(60_000).send('B', finishMsg(1));
    expect(sim.player('Beto').games[0]).toMatchObject({ status: 'solved', elapsedMs: 60_000 });
    expect(sim.of('B', 'timeUp')).toEqual([]);
  });

  it('rendirse suma el límite completo y pasa a la siguiente', () => {
    const sim = lobby(config('timeAttack', partidas));
    begin(sim);
    sim.at(5_000).send('A', { type: 'surrender', index: 1 });
    expect(sim.player('Ana').games[0]).toMatchObject({ status: 'surrendered' });
    expect(sim.player('Ana').current).toBe(2);
    sim.at(6_000).send('A', { type: 'loaded', index: 2 });
    sim.at(7_000).send('A', finishMsg(2));
    sim.at(8_000).send('B', finishMsg(1));
    sim.at(8_500).send('B', { type: 'loaded', index: 2 });
    sim.at(9_000).send('B', finishMsg(2));
    // Ana: 60 s (rendida) + 1 s; Beto: 8 s + 0,5 s.
    expect(sim.results().table.map((row) => [row.playerId, row.totalMs])).toEqual([
      [sim.id('Beto'), 8_000 + 500],
      [sim.id('Ana'), 60_000 + 1_000],
    ]);
  });

  it('avisos fuera de orden se rechazan: progreso o final de otra partida, un segundo final, votos fuera de la votación', () => {
    const sim = lobby(config('timeAttack', partidas));
    begin(sim);
    sim.at(1_000).send('A', { type: 'progress', index: 2, attempts: 1 });
    sim.send('A', finishMsg(2));
    sim.send('A', { type: 'loaded', index: 2 });
    sim.send('A', { type: 'vote', option: { played: 1 } });
    expect(sim.errors('A')).toEqual(['bad_message', 'bad_message', 'bad_message', 'not_allowed']);
    sim.send('A', finishMsg(1));
    sim.at(2_000).send('A', finishMsg(1));
    expect(sim.errors('A').at(-1)).toBe('bad_message');
    expect(sim.player('Ana').games[0].attempts).toBe(3);
  });

  it('un jugador que viene más lento no frena el progreso de los demás: cada uno avanza a su ritmo', () => {
    const sim = lobby(config('timeAttack', partidas));
    begin(sim);
    sim.at(10_000).send('A', finishMsg(1));
    expect(sim.player('Ana').current).toBe(2);
    expect(sim.player('Beto').current).toBe(1);
    expect(sim.of('B', 'progress').at(-1)!.progress).toMatchObject({ playerId: sim.id('Ana'), index: 2, status: 'pending', done: 1 });
  });
});

describe('Carrera', () => {
  const partidas = [clasico, silueta];

  it('rechaza Rendirse con not_allowed', () => {
    const sim = lobby(config('race', partidas));
    begin(sim);
    sim.at(5_000).send('A', { type: 'surrender', index: 1 });
    expect(sim.errors('A')).toEqual(['not_allowed']);
    expect(sim.player('Ana').games[0].status).toBe('playing');
    sim.send('A', finishMsg(1, false));
    expect(sim.errors('A')).toEqual(['not_allowed', 'not_allowed']);
  });

  it('2 jugadores, 2 partidas: gana quien llega primero desde el inicio común, la carga incluida', () => {
    const sim = lobby(config('race', partidas));
    begin(sim);
    // La partida siguiente corre desde ya: no espera el aviso.
    sim.at(40_000).send('A', finishMsg(1));
    expect(sim.player('Ana').games[1]).toMatchObject({ status: 'playing', startedAt: sim.state.startsAt! + 40_000 });
    sim.at(30_000 + 20_000).send('B', finishMsg(1));
    sim.at(60_000).send('B', finishMsg(2));
    sim.at(70_000).send('A', finishMsg(2));
    expect(sim.results().table).toEqual([
      { playerId: sim.id('Beto'), place: 1, arrivalMs: 60_000 },
      { playerId: sim.id('Ana'), place: 2, arrivalMs: 70_000 },
    ]);
    expect(sim.state.phase).toBe('finished');
  });

  it('no hay tiempo límite: nunca hay timeUp', () => {
    const sim = lobby(config('race', partidas));
    begin(sim);
    sim.fire(3_000_000);
    expect(sim.of('A', 'timeUp')).toEqual([]);
    expect(sim.state.phase).toBe('playing');
  });
});

describe('Menos intentos', () => {
  const partidas = [clasico, silueta];

  it('2 jugadores, 2 partidas: puntos por posición; el tiempo no desempata', () => {
    const sim = lobby(config('fewestAttempts', partidas));
    begin(sim);
    sim.at(10_000).send('A', finishMsg(1, true, { attempts: 4 }));
    sim.at(11_000).send('A', { type: 'loaded', index: 2 });
    sim.at(1_000_000).send('B', finishMsg(1, true, { attempts: 6 }));
    sim.at(1_001_000).send('B', { type: 'loaded', index: 2 });
    sim.at(1_002_000).send('B', finishMsg(2, true, { attempts: 2 }));
    sim.at(1_003_000).send('A', finishMsg(2, false, { attempts: 6 }));
    // Ana gana la 1 (2 puntos) y pierde la 2 (1); Beto al revés: empatan 3 a 3 y se va a desempate.
    expect(sim.state.phase).toBe('tiebreakVote');
    expect(sim.state.table!.map((row) => [row.place, row.halfPoints])).toEqual([[1, 6], [1, 6]]);
  });

  it('4 jugadores, 1 partida: reparte 4, 3, 2 y 1; quien pierde queda último', () => {
    const sim = lobby(config('fewestAttempts', [clasico]), ['Ana', 'Beto', 'Caro', 'Dani']);
    begin(sim);
    sim.at(10_000).send('A', finishMsg(1, true, { attempts: 5 }));
    sim.at(11_000).send('B', finishMsg(1, true, { attempts: 3 }));
    sim.at(12_000).send('C', finishMsg(1, false, { attempts: 10 }));
    sim.at(13_000).send('D', { type: 'surrender', index: 1 });
    expect(sim.state.phase).toBe('finished');
    expect(sim.results().table.map((row) => [row.playerId, row.place, row.halfPoints])).toEqual([
      [sim.id('Beto'), 1, 8],
      [sim.id('Ana'), 2, 6],
      // Caro y Dani pierden: se reparten los puntos de los puestos 3 y 4.
      [sim.id('Caro'), 3, 3],
      [sim.id('Dani'), 3, 3],
    ]);
  });

  it('Mayor o Menor: fin anticipado cuando ya superó a todos los que terminaron', () => {
    const sim = lobby(config('fewestAttempts', [poder], { higherLowerForgiven: 3 }), ['Ana', 'Beto']);
    begin(sim);
    sim.at(1_000).send('B', { type: 'progress', index: 1, attempts: 5, errors: 1, score: 4 });
    sim.send('A', { type: 'progress', index: 1, attempts: 14, errors: 3, score: 11 });
    // Ana llega a 12 con 1 error y el otro sigue jugando: no termina.
    expect(sim.of('A', 'endNow')).toEqual([]);
    sim.at(2_000).send('B', finishMsg(1, false, { attempts: 12, score: 12 }));
    sim.at(3_000).send('A', { type: 'progress', index: 1, attempts: 15, errors: 3, score: 12 });
    expect(sim.of('A', 'endNow')).toEqual([]);
    sim.at(4_000).send('A', { type: 'progress', index: 1, attempts: 16, errors: 3, score: 13 });
    expect(sim.of('A', 'endNow')).toEqual([{ type: 'endNow', index: 1 }]);
    // Una sola vez.
    sim.at(5_000).send('A', { type: 'progress', index: 1, attempts: 17, errors: 3, score: 14 });
    expect(sim.of('A', 'endNow')).toHaveLength(1);
    sim.at(6_000).send('A', finishMsg(1, true, { attempts: 17, score: 14 }));
    expect(sim.results().table[0]).toMatchObject({ playerId: sim.id('Ana'), place: 1 });
  });

  it('Mayor o Menor: no hay fin anticipado en Contrarreloj ni en Carrera', () => {
    const sim = lobby(config('race', [poder]));
    begin(sim);
    sim.at(1_000).send('B', { type: 'progress', index: 1, attempts: 5, score: 1 });
    sim.send('B', finishMsg(1, true, { attempts: 5, score: 10 }));
    sim.at(2_000).send('A', { type: 'progress', index: 1, attempts: 20, score: 15 });
    expect(sim.of('A', 'endNow')).toEqual([]);
  });
});

describe('4 jugadores en cada modalidad', () => {
  const names = ['Ana', 'Beto', 'Caro', 'Dani'];

  it('Contrarreloj: tabla completa con abandono por tiempo', () => {
    const sim = lobby(config('timeAttack', [withLimit(clasico, 60_000)]), names);
    begin(sim);
    sim.at(20_000).send('C', finishMsg(1));
    sim.at(30_000).send('A', finishMsg(1));
    sim.at(40_000).send('D', finishMsg(1));
    sim.fire(60_000);
    expect(sim.state.phase).toBe('finished');
    expect(sim.results().table.map((row) => [row.playerId, row.place, row.totalMs])).toEqual([
      [sim.id('Caro'), 1, 20_000],
      [sim.id('Ana'), 2, 30_000],
      [sim.id('Dani'), 3, 40_000],
      [sim.id('Beto'), 4, 60_000],
    ]);
  });

  it('Carrera: orden de llegada', () => {
    const sim = lobby(config('race', [clasico, silueta]), names);
    begin(sim);
    sim.at(10_000).send('B', finishMsg(1));
    sim.at(11_000).send('D', finishMsg(1));
    sim.at(12_000).send('A', finishMsg(1));
    sim.at(13_000).send('C', finishMsg(1));
    sim.at(20_000).send('C', finishMsg(2));
    sim.at(21_000).send('A', finishMsg(2));
    sim.at(22_000).send('B', finishMsg(2));
    sim.at(23_000).send('D', finishMsg(2));
    expect(sim.results().table.map((row) => [row.playerId, row.place])).toEqual([
      [sim.id('Caro'), 1],
      [sim.id('Ana'), 2],
      [sim.id('Beto'), 3],
      [sim.id('Dani'), 4],
    ]);
  });

  it('Menos intentos con empates en el segundo puesto: no hay desempate', () => {
    const sim = lobby(config('fewestAttempts', [clasico]), names);
    begin(sim);
    sim.at(1_000).send('A', finishMsg(1, true, { attempts: 2 }));
    sim.at(2_000).send('B', finishMsg(1, true, { attempts: 5 }));
    sim.at(3_000).send('C', finishMsg(1, true, { attempts: 5 }));
    sim.at(4_000).send('D', finishMsg(1, true, { attempts: 9 }));
    expect(sim.state.phase).toBe('finished');
    expect(sim.results().table.map((row) => row.place)).toEqual([1, 2, 2, 4]);
    expect(sim.of('A', 'tiebreak')).toEqual([]);
  });
});

describe('desempate', () => {
  /** Dos jugadores que empatan: cada uno gana una partida de Menos intentos. */
  function tied(extra: { names?: string[]; partidas?: Partida[] } = {}): Sim {
    const sim = lobby(config('fewestAttempts', extra.partidas ?? [clasico, silueta]), extra.names ?? ['Ana', 'Beto']);
    begin(sim);
    sim.at(1_000).send('A', finishMsg(1, true, { attempts: 3 }));
    sim.at(1_100).send('A', { type: 'loaded', index: 2 });
    sim.at(2_000).send('B', finishMsg(1, true, { attempts: 6 }));
    sim.at(2_100).send('B', { type: 'loaded', index: 2 });
    sim.at(3_000).send('B', finishMsg(2, true, { attempts: 2 }));
    sim.at(4_000).send('A', finishMsg(2, true, { attempts: 6 }));
    return sim;
  }

  it('al cerrar la última partida con empate arriba, abre la votación de 30 s solo para los empatados', () => {
    const sim = tied({ names: ['Ana', 'Beto', 'Caro'] });
    // Caro todavía no jugó: el empate se detecta cuando termina.
    expect(sim.state.phase).toBe('playing');
    sim.at(5_000).send('C', finishMsg(1, true, { attempts: 9 }));
    sim.at(5_100).send('C', { type: 'loaded', index: 2 });
    sim.at(6_000).send('C', finishMsg(2, true, { attempts: 9 }));
    expect(sim.state.phase).toBe('tiebreakVote');
    const view = sim.of('A', 'tiebreak')[0].tiebreak;
    expect(view).toMatchObject({ round: 1, votingEndsAt: sim.state.startsAt! + 6_000 + VOTE_MS, voted: 0 });
    expect([...view.players].sort()).toEqual([sim.id('Ana'), sim.id('Beto')].sort());
    // Los modos jugados, sin repetir (y tampoco la tabla del tercero).
    expect(view.played.map((option) => option.index)).toEqual([1, 2]);
    // Caro no está empatado: no puede votar.
    sim.at(7_000).send('C', { type: 'vote', option: { played: 1 } });
    expect(sim.errors('C').at(-1)).toBe('not_allowed');
  });

  it('votos iguales: se juega esa opción, sin ruleta de varias porciones, y gana quien queda primero en la partida extra', () => {
    const sim = tied();
    expect(sim.state.phase).toBe('tiebreakVote');
    const voteEnd = sim.state.vote!.endsAt;
    sim.at(5_000).send('A', { type: 'vote', option: { played: 1 } });
    expect(sim.of('B', 'votes').at(-1)).toMatchObject({ voted: 1, total: 2 });
    expect(sim.of('B', 'votes').at(-1)!.votes).toBeUndefined();
    sim.at(6_000).send('B', { type: 'vote', option: { played: 1 } });
    // Votaron todos: cierra sola.
    expect(sim.state.phase).toBe('tiebreakSpin');
    expect(sim.of('A', 'votes').at(-1)!.votes).toHaveLength(2);
    const spin = sim.of('A', 'spin')[0].spin;
    expect(spin.options).toEqual([{ option: { played: 1 }, votes: 2 }]);
    expect(sim.state.vote).toBeUndefined();
    expect(voteEnd).toBeGreaterThan(sim.state.spin!.endsAt - SPIN_MS);
    // A los 4 s empieza la partida extra, con el índice siguiente al diez: un reto nuevo.
    sim.fire(6_000 + SPIN_MS);
    expect(sim.state.phase).toBe('tiebreakPlaying');
    expect(sim.of('A', 'tiebreakStart')[0]).toMatchObject({ index: TIEBREAK_FIRST_INDEX, partida: { mode: 'clasico' } });
    expect(sim.player('Ana').current).toBe(TIEBREAK_FIRST_INDEX);
    sim.at(6_000 + SPIN_MS + 100).send('A', { type: 'loaded', index: TIEBREAK_FIRST_INDEX });
    sim.at(6_000 + SPIN_MS + 100).send('B', { type: 'loaded', index: TIEBREAK_FIRST_INDEX });
    sim.at(20_000).send('B', finishMsg(TIEBREAK_FIRST_INDEX, true, { attempts: 3 }));
    sim.at(21_000).send('A', finishMsg(TIEBREAK_FIRST_INDEX, true, { attempts: 7 }));
    expect(sim.state.phase).toBe('finished');
    const results = sim.results();
    expect(results.tiebreakWon).toBe(true);
    expect(results.table.map((row) => [row.playerId, row.place])).toEqual([
      [sim.id('Beto'), 1],
      [sim.id('Ana'), 2],
    ]);
    expect(results.partidas.at(-1)).toMatchObject({ index: TIEBREAK_FIRST_INDEX, tiebreak: true });
  });

  it('votos distintos: ruleta proporcional a los votos (cada voto es una porción igual)', () => {
    const three = lobby(config('fewestAttempts', [clasico]), ['Ana', 'Beto', 'Caro']);
    begin(three);
    three.at(1_000).send('A', finishMsg(1, true, { attempts: 4 }));
    three.at(1_100).send('B', finishMsg(1, true, { attempts: 4 }));
    three.at(1_200).send('C', finishMsg(1, true, { attempts: 4 }));
    expect(three.state.phase).toBe('tiebreakVote');
    three.at(2_000).send('A', { type: 'vote', option: { played: 1 } });
    three.at(2_100).send('B', { type: 'vote', option: { other: { ...silueta } } });
    three.at(2_200).send('C', { type: 'vote', option: { other: { ...silueta } } });
    const spin = three.of('A', 'spin')[0].spin;
    expect(spin.options).toEqual([
      { option: { played: 1 }, votes: 1 },
      { option: { other: silueta }, votes: 2 },
    ]);
    expect(spin.winner === 0 || spin.winner === 1).toBe(true);
    expect(spin.endsAt).toBe(three.state.startsAt! + 2_200 + SPIN_MS);
    // El resultado ya está decidido por el servidor y es el mismo para todos.
    expect(three.of('B', 'spin')[0].spin).toEqual(spin);
  });

  it('con otro azar, el mismo empate sortea otra opción (el reductor no lleva su propio azar)', () => {
    const run = (entropy: string) => {
      const sim = lobby(config('fewestAttempts', [clasico]), ['Ana', 'Beto', 'Caro']);
      begin(sim);
      sim.at(1_000).send('A', finishMsg(1, true, { attempts: 4 }));
      sim.at(1_100).send('B', finishMsg(1, true, { attempts: 4 }));
      sim.at(1_200).send('C', finishMsg(1, true, { attempts: 4 }));
      sim.at(2_000).send('A', { type: 'vote', option: { played: 1 } });
      sim.at(2_100).send('B', { type: 'vote', option: { other: silueta } });
      sim.now = sim.state.startsAt! + 3_000;
      sim.run({ type: 'message', conn: 'C', message: { type: 'vote', option: { other: silueta } }, entropy });
      return sim.state.spin!.outcome.partida.mode;
    };
    const modes = new Set(Array.from({ length: 60 }, (_, n) => run(entropyOf(5_000 + n))));
    expect(modes).toEqual(new Set(['clasico', 'silueta']));
    // El mismo azar da el mismo resultado.
    expect(run(entropyOf(7))).toBe(run(entropyOf(7)));
  });

  it('a los 30 s cierra sola: sin votos, la ruleta usa los modos jugados; los que no votaron no cuentan', () => {
    const sim = tied();
    const closes = sim.state.vote!.endsAt;
    sim.goto(closes - 1);
    expect(sim.state.phase).toBe('tiebreakVote');
    sim.goto(closes);
    expect(sim.state.phase).toBe('tiebreakSpin');
    const spin = sim.of('A', 'spin')[0].spin;
    expect(spin.options).toEqual([{ option: { played: 1 }, votes: 1 }, { option: { played: 2 }, votes: 1 }]);
    expect(sim.of('A', 'votes').at(-1)).toMatchObject({ voted: 0, total: 2, votes: [] });

    const partial = tied();
    partial.at(5_000).send('A', { type: 'vote', option: { played: 2 } });
    partial.goto(partial.state.vote!.endsAt);
    expect(partial.of('A', 'spin')[0].spin.options).toEqual([{ option: { played: 2 }, votes: 1 }]);
  });

  it('se puede cambiar el voto hasta que cierre', () => {
    const sim = tied();
    sim.at(5_000).send('A', { type: 'vote', option: { played: 1 } });
    sim.at(5_500).send('A', { type: 'vote', option: { played: 2 } });
    expect(sim.state.vote!.votes[sim.id('Ana')]).toEqual({ played: 2 });
    expect(sim.of('B', 'votes').at(-1)).toMatchObject({ voted: 1 });
    sim.send('A', { type: 'vote', option: { played: 99 } });
    expect(sim.errors('A').at(-1)).toBe('bad_message');
  });

  it('un segundo empate abre otra votación entre los que siguen empatados', () => {
    const sim = lobby(config('fewestAttempts', [clasico]), ['Ana', 'Beto', 'Caro']);
    begin(sim);
    sim.at(1_000).send('A', finishMsg(1, true, { attempts: 4 }));
    sim.at(1_100).send('B', finishMsg(1, true, { attempts: 4 }));
    sim.at(1_200).send('C', finishMsg(1, true, { attempts: 4 }));
    // Se juega la partida extra: Caro gana; Ana y Beto vuelven a empatar.
    sim.goto(sim.state.vote!.endsAt);
    sim.goto(sim.state.spin!.endsAt);
    const index = TIEBREAK_FIRST_INDEX;
    for (const conn of ['A', 'B', 'C']) sim.send(conn, { type: 'loaded', index });
    sim.send('C', finishMsg(index, true, { attempts: 9 }));
    sim.send('A', finishMsg(index, true, { attempts: 5 }));
    sim.send('B', finishMsg(index, true, { attempts: 5 }));
    expect(sim.state.phase).toBe('tiebreakVote');
    expect(sim.state.vote).toMatchObject({ round: 2 });
    expect([...sim.state.vote!.tied].sort()).toEqual([sim.id('Ana'), sim.id('Beto')].sort());
    // Caro ya quedó tercero y no vota; la tabla conserva el orden.
    expect(sim.state.table!.map((row) => row.place).sort()).toEqual([1, 1, 3]);
    expect(sim.of('C', 'tiebreak').at(-1)!.tiebreak.round).toBe(2);
    sim.send('C', { type: 'vote', option: { played: 1 } });
    expect(sim.errors('C').at(-1)).toBe('not_allowed');
  });

  it('un empate a nivel de segundo puesto del desempate no vuelve a votar; el que sigue empatado arriba sí', () => {
    // Tres empatados: gana Caro el desempate y quedan Ana y Beto empatados segundos: no hay otra votación.
    const sim = lobby(config('fewestAttempts', [clasico]), ['Ana', 'Beto', 'Caro']);
    begin(sim);
    sim.at(1_000).send('A', finishMsg(1, true, { attempts: 4 }));
    sim.at(1_100).send('B', finishMsg(1, true, { attempts: 4 }));
    sim.at(1_200).send('C', finishMsg(1, true, { attempts: 4 }));
    sim.goto(sim.state.vote!.endsAt);
    sim.goto(sim.state.spin!.endsAt);
    for (const conn of ['A', 'B', 'C']) sim.send(conn, { type: 'loaded', index: TIEBREAK_FIRST_INDEX });
    sim.send('A', finishMsg(TIEBREAK_FIRST_INDEX, true, { attempts: 9 }));
    sim.send('B', finishMsg(TIEBREAK_FIRST_INDEX, true, { attempts: 9 }));
    sim.send('C', finishMsg(TIEBREAK_FIRST_INDEX, true, { attempts: 1 }));
    expect(sim.state.vote).toBeUndefined();
    expect(sim.state.phase).toBe('finished');
  });

  it('Contrarreloj: todos se quedan sin tiempo en todas las partidas, empatan y el desempate usa el tiempo por defecto del modo', () => {
    const sim = lobby(config('timeAttack', [{ ...withLimit(clasico, 60_000), timeLimitMs: 45_000, timeEdited: true }]), ['Ana', 'Beto']);
    begin(sim);
    sim.fire(45_000);
    expect(sim.state.phase).toBe('tiebreakVote');
    expect(sim.state.table!.every((row) => row.totalMs === 45_000)).toBe(true);
    sim.goto(sim.state.vote!.endsAt);
    sim.goto(sim.state.spin!.endsAt);
    // Aunque el creador editó el tiempo a 45 s, el desempate usa el de por defecto (60 s).
    expect(sim.of('A', 'tiebreakStart')[0].partida.timeLimitMs).toBe(60_000);
    sim.send('A', { type: 'loaded', index: TIEBREAK_FIRST_INDEX });
    sim.send('B', { type: 'loaded', index: TIEBREAK_FIRST_INDEX });
    const started = sim.player('Ana').games[1].startedAt!;
    sim.goto(started + 10_000).send('B', finishMsg(TIEBREAK_FIRST_INDEX));
    sim.goto(started + 60_000);
    expect(sim.state.phase).toBe('finished');
    expect(sim.results().table.map((row) => [row.playerId, row.place])).toEqual([
      [sim.id('Beto'), 1],
      [sim.id('Ana'), 2],
    ]);
  });

  it('en el desempate, quien abandona lo pierde; si queda uno solo, gana', () => {
    const sim = tied();
    sim.goto(sim.state.vote!.endsAt);
    sim.goto(sim.state.spin!.endsAt);
    sim.send('A', { type: 'loaded', index: TIEBREAK_FIRST_INDEX });
    sim.send('B', { type: 'loaded', index: TIEBREAK_FIRST_INDEX });
    sim.send('B', { type: 'leave' });
    expect(sim.state.phase).toBe('finished');
    expect(sim.results().table[0]).toMatchObject({ playerId: sim.id('Ana'), place: 1 });
  });

  it('quien abandona durante la votación deja la votación: si queda uno, gana', () => {
    const sim = tied();
    sim.at(5_000).send('B', { type: 'leave' });
    expect(sim.state.phase).toBe('finished');
    expect(sim.results().table[0]).toMatchObject({ playerId: sim.id('Ana'), place: 1 });
    expect(sim.results().tiebreakWon).toBe(true);
  });

  it('Mayor o Menor en el desempate también termina solo al superar a todos los participantes', () => {
    const sim = lobby(config('fewestAttempts', [clasico], { higherLowerForgiven: 3 }), ['Ana', 'Beto', 'Caro']);
    begin(sim);
    sim.at(1_000).send('A', finishMsg(1, true, { attempts: 4 }));
    sim.at(1_100).send('B', finishMsg(1, true, { attempts: 4 }));
    sim.at(1_200).send('C', finishMsg(1, true, { attempts: 9 }));
    sim.at(2_000).send('A', { type: 'vote', option: { other: poder } });
    sim.at(2_100).send('B', { type: 'vote', option: { other: poder } });
    sim.goto(sim.state.spin!.endsAt);
    expect(sim.of('A', 'tiebreakStart')[0]).toMatchObject({ index: TIEBREAK_FIRST_INDEX, partida: { engine: 'higher-lower' } });
    sim.send('A', { type: 'loaded', index: TIEBREAK_FIRST_INDEX });
    sim.send('B', { type: 'loaded', index: TIEBREAK_FIRST_INDEX });
    sim.send('B', finishMsg(TIEBREAK_FIRST_INDEX, false, { attempts: 9, score: 3 }));
    // Caro no juega el desempate: no cuenta para el fin anticipado.
    sim.send('A', { type: 'progress', index: TIEBREAK_FIRST_INDEX, attempts: 8, errors: 3, score: 3 });
    expect(sim.of('A', 'endNow')).toEqual([]);
    sim.send('A', { type: 'progress', index: TIEBREAK_FIRST_INDEX, attempts: 9, errors: 3, score: 4 });
    expect(sim.of('A', 'endNow')).toEqual([{ type: 'endNow', index: TIEBREAK_FIRST_INDEX }]);
    expect(sim.of('C', 'endNow')).toEqual([]);
  });
});

describe('desconexiones, reconexión y abandono', () => {
  it('en la sala de espera, desconectarse no saca a nadie hasta pasados los 2 minutos', () => {
    const sim = lobby(config('race', [clasico]));
    sim.run({ type: 'disconnect', conn: 'B' });
    expect(sim.state.players.find((player) => player.name === 'Beto')!.disconnectedAt).toBe(START);
    expect(sim.of('A', 'players').at(-1)!.players.find((player) => player.name === 'Beto')!.connected).toBe(false);
    sim.goto(START + RECONNECT_MS - 1);
    expect(sim.state.players).toHaveLength(2);
    sim.goto(START + RECONNECT_MS);
    expect(sim.state.players.map((player) => player.name)).toEqual(['Ana']);
  });

  it('vuelve dentro de los 2 minutos con su token y recupera su lugar y el estado', () => {
    const long = lobby(config('timeAttack', [withLimit(clasico, 600_000)]));
    begin(long);
    long.at(5_000).send('B', { type: 'progress', index: 1, attempts: 4 });
    long.at(6_000).run({ type: 'disconnect', conn: 'B' });
    long.fire(6_000 + RECONNECT_MS - 1);
    expect(long.player('Beto').abandoned).toBe(false);
    long.run({ type: 'connect', conn: 'B2', token: long.tokens.get('Beto') });
    long.send('B2', { type: 'hello', protocol: PROTOCOL_VERSION });
    const snapshot = long.of('B2', 'snapshot').at(-1)!;
    expect(snapshot.you).toMatchObject({ playerId: long.id('Beto'), spectator: false });
    expect(snapshot.seed).toBe(long.state.seed);
    expect(snapshot.mine).toMatchObject({ index: 1, status: 'playing', endsAt: long.state.startsAt! + 600_000 });
    expect(long.player('Beto').disconnectedAt).toBeUndefined();
    // Su tiempo siguió corriendo todo el rato: nada se detuvo mientras no estaba.
    long.goto(long.state.startsAt! + 600_000);
    expect(long.player('Beto').games[0].status).toBe('timeUp');
  });

  it('pasados 2 minutos abandona; ya no puede volver como jugador', () => {
    const sim = lobby(config('timeAttack', [withLimit(clasico, 600_000)]), ['Ana', 'Beto', 'Caro']);
    begin(sim);
    sim.at(6_000).run({ type: 'disconnect', conn: 'B' });
    sim.fire(6_000 + RECONNECT_MS);
    expect(sim.player('Beto')).toMatchObject({ abandoned: true, current: null });
    expect(sim.player('Beto').games[0].status).toBe('abandoned');
    expect(sim.of('A', 'players').at(-1)!.players.find((player) => player.name === 'Beto')!.abandoned).toBe(true);
    sim.run({ type: 'connect', conn: 'B3', token: sim.tokens.get('Beto') });
    sim.send('B3', { type: 'hello', protocol: PROTOCOL_VERSION });
    expect(sim.of('B3', 'snapshot').at(-1)!.you.spectator).toBe(true);
  });

  it('Contrarreloj: al abandonar, las partidas que le faltan suman el límite completo', () => {
    const sim = lobby(config('timeAttack', [withLimit(clasico, 60_000), withLimit(silueta, 90_000)]), ['Ana', 'Beto']);
    begin(sim);
    sim.at(10_000).send('A', finishMsg(1));
    sim.at(11_000).send('A', { type: 'loaded', index: 2 });
    sim.at(20_000).send('A', finishMsg(2));
    sim.at(30_000).send('B', { type: 'leave' });
    expect(sim.state.phase).toBe('finished');
    // Con un solo jugador activo gana ese: la sala termina sin esperar.
    const table = sim.results().table;
    expect(table[0]).toMatchObject({ playerId: sim.id('Ana'), place: 1, totalMs: 19_000 });
    expect(table[1]).toMatchObject({ playerId: sim.id('Beto'), place: 2, totalMs: 150_000 });
  });

  it('Carrera: quien abandona queda último', () => {
    const sim = lobby(config('race', [clasico, silueta]), ['Ana', 'Beto', 'Caro']);
    begin(sim);
    sim.at(10_000).send('A', finishMsg(1));
    sim.at(20_000).send('C', finishMsg(1));
    sim.at(21_000).send('B', { type: 'leave' });
    sim.at(30_000).send('C', finishMsg(2));
    sim.at(40_000).send('A', finishMsg(2));
    expect(sim.results().table.map((row) => [row.playerId, row.place])).toEqual([
      [sim.id('Caro'), 1],
      [sim.id('Ana'), 2],
      [sim.id('Beto'), 3],
    ]);
  });

  it('Menos intentos: lo que le falta cuenta como perdido y queda último', () => {
    const sim = lobby(config('fewestAttempts', [clasico, silueta]), ['Ana', 'Beto', 'Caro']);
    begin(sim);
    sim.at(1_000).send('A', finishMsg(1, true, { attempts: 2 }));
    sim.at(1_100).send('A', { type: 'loaded', index: 2 });
    sim.at(2_000).send('B', { type: 'leave' });
    sim.at(3_000).send('C', finishMsg(1, true, { attempts: 5 }));
    sim.at(3_100).send('C', { type: 'loaded', index: 2 });
    sim.at(4_000).send('C', finishMsg(2, true, { attempts: 4 }));
    sim.at(5_000).send('A', finishMsg(2, true, { attempts: 3 }));
    // Partida 1: Ana 3, Caro 2, Beto 1 (abandonó). Partida 2: igual. Los puntos se guardan en medios.
    expect(sim.results().table.map((row) => [row.playerId, row.place, row.halfPoints])).toEqual([
      [sim.id('Ana'), 1, 12],
      [sim.id('Caro'), 2, 8],
      [sim.id('Beto'), 3, 4],
    ]);
  });

  it('si queda un solo jugador activo y los demás abandonaron, la sala termina y ese gana', () => {
    const sim = lobby(config('fewestAttempts', [clasico]), ['Ana', 'Beto', 'Caro']);
    begin(sim);
    sim.at(1_000).send('B', { type: 'leave' });
    expect(sim.state.phase).toBe('playing');
    sim.at(2_000).send('C', { type: 'leave' });
    expect(sim.state.phase).toBe('finished');
    expect(sim.results().table[0]).toMatchObject({ playerId: sim.id('Ana'), place: 1 });
  });

  it('salir en la cuenta regresiva no deja consecuencias: con menos de 2 vuelve a la sala de espera', () => {
    const sim = lobby(config('race', [clasico]));
    for (const conn of ['A', 'B']) sim.send(conn, { type: 'ready', value: true });
    sim.send('A', { type: 'start' });
    expect(sim.state.phase).toBe('countdown');
    sim.send('B', { type: 'leave' });
    expect(sim.state.phase).toBe('lobby');
    expect(sim.state.startsAt).toBeUndefined();
    expect(sim.of('A', 'lobby')).toHaveLength(1);
    sim.goto(START + COUNTDOWN_MS + 10_000);
    expect(sim.state.phase).toBe('lobby');
  });

  it('el anfitrión que abandona en plena partida pasa la corona', () => {
    const sim = lobby(config('race', [clasico]), ['Ana', 'Beto', 'Caro']);
    begin(sim);
    sim.at(1_000).send('A', { type: 'leave' });
    expect(sim.state.hostId).toBe(sim.id('Beto'));
  });
});

describe('final y revancha', () => {
  function finished(): Sim {
    const sim = lobby(config('race', [clasico]));
    begin(sim);
    sim.at(10_000).send('A', finishMsg(1));
    sim.at(20_000).send('B', finishMsg(1));
    return sim;
  }

  it('al terminar manda los resultados a todos, también a los espectadores', () => {
    const sim = lobby(config('race', [clasico]));
    sim.connect('S');
    begin(sim);
    sim.at(10_000).send('A', finishMsg(1));
    sim.at(20_000).send('B', finishMsg(1));
    for (const conn of ['A', 'B', 'S']) expect(sim.of(conn, 'results')).toHaveLength(1);
    expect(snapshotFor(sim.state, 'S', sim.now).results).toBeDefined();
  });

  it('una sala terminada se borra a las 24 horas', () => {
    const sim = finished();
    const end = sim.state.finishedAt!;
    sim.goto(end + FINISHED_TTL_MS - 1);
    expect(sim.destroyed).toBe(false);
    sim.goto(end + FINISHED_TTL_MS);
    expect(sim.destroyed).toBe(true);
  });

  it('revancha: solo el creador, con la sala terminada; crea una sala con los que siguen conectados y otra semilla', () => {
    const sim = finished();
    sim.send('B', { type: 'rematch' }, { newCode: 'ABCD23' });
    expect(sim.errors('B')).toEqual(['not_host']);
    const early = lobby(config('race', [clasico]));
    early.send('A', { type: 'rematch' }, { newCode: 'ABCD23' });
    expect(early.errors('A')).toEqual(['not_allowed']);
    sim.run({ type: 'disconnect', conn: 'B' });
    sim.send('A', { type: 'rematch' }, { newCode: 'ABCD23' });
    expect(sim.of('A', 'rematch')).toEqual([{ type: 'rematch', code: 'ABCD23' }]);
    expect(sim.effects).toHaveLength(1);
    const created = sim.effects[0].state;
    expect(created.code).toBe('ABCD23');
    expect(created.phase).toBe('lobby');
    expect(created.seed).not.toBe(sim.state.seed);
    expect(created.config).toEqual(sim.state.config);
    // Solo siguió conectado el creador.
    expect(created.players.map((player) => player.name)).toEqual(['Ana']);
    expect(created.hostId).toBe(sim.id('Ana'));
    expect(created.players[0].token).toBe(sim.tokens.get('Ana'));
    // Pedirla de nuevo no crea otra.
    sim.send('A', { type: 'rematch' }, { newCode: 'ZZZZ22' });
    expect(sim.effects).toHaveLength(1);
    expect(sim.of('A', 'rematch').at(-1)!.code).toBe('ABCD23');
    expect(snapshotFor(sim.state, 'A', sim.now).rematch).toBe('ABCD23');
  });

  it('si no se pudo crear la sala nueva, se limpia y el creador puede volver a intentarlo', () => {
    const sim = finished();
    sim.send('A', { type: 'rematch' }, { newCode: 'ABCD23' });
    sim.run({ type: 'rematchFailed' });
    expect(sim.state.rematch).toBeUndefined();
    expect(sim.errors('A')).toEqual(['not_allowed']);
    sim.send('A', { type: 'rematch' }, { newCode: 'EFGH45' });
    expect(sim.effects.at(-1)!.code).toBe('EFGH45');
  });
});

describe('el reductor es puro', () => {
  it('no modifica el estado que recibe y devuelve las alarmas pendientes de menor a mayor', () => {
    const sim = lobby(config('timeAttack', [withLimit(clasico, 60_000)]));
    begin(sim);
    const before = JSON.stringify(sim.state);
    const output = reduce(sim.state, { type: 'message', conn: 'A', message: { type: 'progress', index: 1, attempts: 1 }, entropy: entropyOf(9) }, sim.now + 1_000);
    expect(JSON.stringify(sim.state)).toBe(before);
    expect(output.alarms).toEqual([...output.alarms].sort((a, b) => a - b));
    expect(output.alarms[0]).toBe(sim.state.startsAt! + 60_000);
  });

  it('mismo estado, mismo evento, mismo azar y misma hora: mismo resultado', () => {
    const sim = lobby(config('timeAttack', [withLimit(clasico, 60_000)]));
    begin(sim);
    const event: RoomEvent = { type: 'message', conn: 'A', message: finishMsg(1), entropy: entropyOf(3) };
    expect(JSON.stringify(reduce(sim.state, event, sim.now + 5))).toBe(JSON.stringify(reduce(sim.state, event, sim.now + 5)));
  });

  it('pide azar suficiente', () => {
    const sim = lobby(config('race', [clasico]));
    expect(() => reduce(sim.state, { type: 'alarm', entropy: 'abc' }, sim.now)).toThrow(/entropy/);
  });

  it('un mensaje de una conexión desconocida se ignora', () => {
    const sim = lobby(config('race', [clasico]));
    const output = sim.send('nadie', { type: 'start' });
    expect(output.send).toEqual([]);
  });
});
