import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PING, PONG, PROTOCOL_VERSION, encodeMessage, type ServerMessage } from '@/versus/protocol';
import { DEFAULT_OPTIONS } from '@/versus/config';
import {
  BACKOFF_MAX_MS,
  MAX_FAILURES,
  PING_EVERY_MS,
  VersusClient,
  backoffDelay,
  versusEnabled,
  versusUrl,
  type ConnectionStatus,
  type SocketLike,
} from './client';

// Con un WebSocket falso: conexión, mensajes, reconexión con espera creciente, paso a `unavailable` tras 5 fallos seguidos y
// corrección del reloj (docs/versus/04-fase-2-servidor.md, paso 2.5).

class FakeSocket implements SocketLike {
  static all: FakeSocket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];
  closed = false;
  readonly url: string;

  constructor(url: string) {
    this.url = url;
    FakeSocket.all.push(this);
  }

  send(text: string): void {
    this.sent.push(text);
  }

  close(): void {
    this.closed = true;
    this.readyState = 3;
  }

  /** El servidor aceptó la conexión. */
  accept(): void {
    this.readyState = 1;
    this.onopen?.();
  }

  receive(message: ServerMessage | string): void {
    this.onmessage?.({ data: typeof message === 'string' ? message : encodeMessage(message) });
  }

  /** La conexión se cortó (sin haberse abierto, o después). */
  drop(code = 1006): void {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

const config = { modality: 'race' as const, partidas: [{ franchise: 'pokemon', mode: 'clasico', engine: 'classic' as const, series: ['g1'] }], options: { ...DEFAULT_OPTIONS } };
const snapshot = (serverNow: number, you: { playerId?: string; token?: string; spectator: boolean } = { spectator: true }): ServerMessage => ({
  type: 'snapshot',
  protocol: PROTOCOL_VERSION,
  serverNow,
  code: 'K7P2QX',
  phase: 'lobby',
  config,
  you,
  hostId: 'p1',
  players: [],
  progress: [],
  tiebreakGames: [],
});

function make(extra: { token?: string; name?: string } = {}) {
  const client = new VersusClient({ url: 'wss://servidor.example', code: 'K7P2QX', ...extra, createSocket: (url) => new FakeSocket(url) });
  const statuses: ConnectionStatus[] = [];
  const messages: ServerMessage[] = [];
  client.onStatus((status) => statuses.push(status));
  client.onMessage((message) => messages.push(message));
  return { client, statuses, messages };
}

const last = () => FakeSocket.all[FakeSocket.all.length - 1];

beforeEach(() => {
  FakeSocket.all = [];
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('conexión', () => {
  it('conecta a la sala; al abrirse manda el hello con el apodo (sin token todavía)', () => {
    const { client, statuses } = make({ name: 'Ana' });
    expect(client.status).toBe('connecting');
    client.connect();
    expect(last().url).toBe('wss://servidor.example/rooms/K7P2QX/ws');
    last().accept();
    expect(statuses).toEqual(['open']);
    expect(JSON.parse(last().sent[0])).toEqual({ type: 'hello', protocol: PROTOCOL_VERSION, name: 'Ana' });
  });

  it('con token lo manda en la URL y no repite el apodo', () => {
    const { client } = make({ token: 'abc 123', name: 'Ana' });
    client.connect();
    expect(last().url).toBe('wss://servidor.example/rooms/K7P2QX/ws?token=abc%20123');
    last().accept();
    expect(JSON.parse(last().sent[0])).toEqual({ type: 'hello', protocol: PROTOCOL_VERSION });
  });

  it('manda mensajes solo con la conexión abierta', () => {
    const { client } = make();
    client.connect();
    expect(client.send({ type: 'start' })).toBe(false);
    last().accept();
    expect(client.send({ type: 'ready', value: true })).toBe(true);
    expect(JSON.parse(last().sent.at(-1)!)).toEqual({ type: 'ready', value: true });
  });

  it('entrega los mensajes validados y descarta lo que no es un mensaje del servidor', () => {
    const { client, messages } = make();
    client.connect();
    last().accept();
    last().receive({ type: 'lobby', serverNow: 5 });
    last().receive('no es json');
    last().receive(JSON.stringify({ type: 'countdown', startsAt: 'ya' }));
    last().receive(PONG);
    last().receive({ type: 'endNow', index: 2 });
    expect(messages.map((message) => message.type)).toEqual(['lobby', 'endNow']);
    expect(client.status).toBe('open');
  });

  it('manda un ping cada 25 s mientras está abierta, y deja de mandarlo al cerrar', () => {
    const { client } = make();
    client.connect();
    last().accept();
    const socket = last();
    vi.advanceTimersByTime(PING_EVERY_MS * 2 + 10);
    expect(socket.sent.filter((text) => text === PING)).toHaveLength(2);
    client.close();
    vi.advanceTimersByTime(PING_EVERY_MS * 3);
    expect(socket.sent.filter((text) => text === PING)).toHaveLength(2);
  });

  it('guarda el token que manda el servidor al unirse y reconecta con él', () => {
    const { client } = make({ name: 'Ana' });
    client.connect();
    last().accept();
    last().receive(snapshot(2_000_000, { playerId: 'p1', token: 'secreto', spectator: false }));
    expect(client.credentials).toBe('secreto');
    last().drop();
    vi.advanceTimersByTime(1_000);
    expect(last().url).toBe('wss://servidor.example/rooms/K7P2QX/ws?token=secreto');
    last().accept();
    expect(JSON.parse(last().sent[0])).toEqual({ type: 'hello', protocol: PROTOCOL_VERSION });
  });
});

describe('reconexión', () => {
  it('la espera crece: 1, 2, 4 y 8 segundos; el quinto fallo seguido deja el servidor como no disponible', () => {
    expect(backoffDelay(0)).toBe(1_000);
    expect(backoffDelay(3)).toBe(8_000);
    expect(backoffDelay(10)).toBe(BACKOFF_MAX_MS);
    const { client, statuses } = make();
    client.connect();
    const waits: number[] = [];
    for (let attempt = 1; attempt < MAX_FAILURES; attempt++) {
      last().drop();
      expect(client.status).toBe('reconnecting');
      const before = FakeSocket.all.length;
      const expected = 1_000 * 2 ** (attempt - 1);
      vi.advanceTimersByTime(expected - 1);
      expect(FakeSocket.all).toHaveLength(before);
      vi.advanceTimersByTime(1);
      expect(FakeSocket.all).toHaveLength(before + 1);
      waits.push(expected);
    }
    expect(waits).toEqual([1_000, 2_000, 4_000, 8_000]);
    // El quinto intento también falla: pasa a `unavailable` y no reintenta más.
    last().drop();
    expect(client.status).toBe('unavailable');
    const total = FakeSocket.all.length;
    vi.advanceTimersByTime(10 * BACKOFF_MAX_MS);
    expect(FakeSocket.all).toHaveLength(total);
    expect(total).toBe(MAX_FAILURES);
    expect(statuses).toEqual(['reconnecting', 'unavailable']);
  });

  it('una conexión que andaba y se corta reintenta al segundo y avisa `reconnecting`; al volver pide el snapshot', () => {
    const { client, statuses, messages } = make({ token: 't' });
    client.connect();
    last().accept();
    last().receive(snapshot(1_000_000));
    last().drop();
    expect(client.status).toBe('reconnecting');
    vi.advanceTimersByTime(1_000);
    last().accept();
    // El hello de la reconexión es lo que hace que el servidor mande el snapshot.
    expect(JSON.parse(last().sent[0]).type).toBe('hello');
    last().receive(snapshot(1_001_000));
    expect(statuses).toEqual(['open', 'reconnecting', 'open']);
    expect(messages.filter((message) => message.type === 'snapshot')).toHaveLength(2);
  });

  it('un snapshot recibido vuelve a cero los fallos seguidos', () => {
    const { client } = make({ token: 't' });
    client.connect();
    for (let i = 0; i < 3; i++) {
      last().drop();
      vi.advanceTimersByTime(backoffDelay(i));
    }
    last().accept();
    last().receive(snapshot(1_000_000));
    last().drop();
    // Otra vez 1 s (y no 8): la cuenta empezó de nuevo.
    const before = FakeSocket.all.length;
    vi.advanceTimersByTime(1_000);
    expect(FakeSocket.all).toHaveLength(before + 1);
  });

  it('abrir y cortarse sin recibir nada sigue contando como fallo (no reconecta en bucle cada segundo)', () => {
    const { client } = make({ token: 't' });
    client.connect();
    for (let i = 0; i < MAX_FAILURES; i++) {
      last().accept();
      last().drop();
      vi.advanceTimersByTime(backoffDelay(i));
    }
    expect(client.status).toBe('unavailable');
  });

  it('`retry` vuelve a intentar desde cero después de `unavailable`', () => {
    const { client } = make();
    client.connect();
    for (let i = 0; i < MAX_FAILURES; i++) {
      last().drop();
      vi.advanceTimersByTime(backoffDelay(i));
    }
    expect(client.status).toBe('unavailable');
    const before = FakeSocket.all.length;
    client.retry();
    expect(FakeSocket.all).toHaveLength(before + 1);
    last().accept();
    expect(client.status).toBe('open');
  });

  it('si el navegador no puede ni crear el WebSocket, cuenta como fallo', () => {
    let calls = 0;
    const client = new VersusClient({
      url: 'wss://x',
      code: 'K7P2QX',
      createSocket: () => {
        calls += 1;
        throw new Error('URL inválida');
      },
    });
    client.connect();
    for (let i = 0; i < MAX_FAILURES; i++) vi.advanceTimersByTime(backoffDelay(i));
    expect(client.status).toBe('unavailable');
    expect(calls).toBe(MAX_FAILURES);
  });
});

describe('cierres definitivos', () => {
  it('close() cierra para siempre: no reconecta ni manda más', () => {
    const { client, statuses } = make();
    client.connect();
    last().accept();
    const socket = last();
    client.close();
    expect(client.status).toBe('closed');
    expect(socket.closed).toBe(true);
    expect(client.send({ type: 'start' })).toBe(false);
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.all).toHaveLength(1);
    expect(statuses).toEqual(['open', 'closed']);
  });

  it('protocol_mismatch: se entrega el error, queda cerrada y no reconecta ("Actualizá la página")', () => {
    const { client, messages } = make();
    client.connect();
    last().accept();
    last().receive({ type: 'error', code: 'protocol_mismatch' });
    expect(client.status).toBe('closed');
    expect(client.closeReason).toBe('protocol_mismatch');
    expect(messages.at(-1)).toMatchObject({ type: 'error', code: 'protocol_mismatch' });
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.all).toHaveLength(1);
  });

  it('expulsión o sala cerrada: no reconecta', () => {
    for (const code of ['kicked', 'room_closed'] as const) {
      FakeSocket.all = [];
      const { client } = make();
      client.connect();
      last().accept();
      last().receive({ type: 'error', code });
      expect(client.status).toBe('closed');
      expect(client.closeReason).toBe(code);
    }
  });

  it('otros errores (sala llena, mensaje malo) no cierran la conexión', () => {
    const { client } = make();
    client.connect();
    last().accept();
    last().receive({ type: 'error', code: 'room_full' });
    last().receive({ type: 'error', code: 'bad_message' });
    expect(client.status).toBe('open');
    expect(client.closeReason).toBeUndefined();
  });

  it('el servidor que cierra con el código normal (1000) termina la conexión para siempre; un corte de red, no', () => {
    const { client } = make();
    client.connect();
    last().accept();
    last().drop(1000);
    expect(client.status).toBe('closed');
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.all).toHaveLength(1);
    const other = make();
    other.client.connect();
    last().accept();
    last().drop(1006);
    expect(other.client.status).toBe('reconnecting');
  });

  it('lo que llega de una conexión vieja se ignora', () => {
    const { client, messages } = make({ token: 't' });
    client.connect();
    const old = last();
    old.accept();
    old.drop();
    vi.advanceTimersByTime(1_000);
    old.receive({ type: 'lobby', serverNow: 1 });
    expect(messages).toEqual([]);
    expect(client.status).toBe('reconnecting');
  });
});

describe('reloj', () => {
  it('sin muestras no corrige nada', () => {
    const { client } = make();
    expect(client.clockOffset).toBe(0);
    expect(client.serverNow()).toBe(Date.now());
  });

  it('el snapshot y la cuenta regresiva traen la hora del servidor: guarda la diferencia con el reloj local', () => {
    const { client } = make();
    client.connect();
    last().accept();
    // El servidor va 2,5 s adelante de este reloj.
    last().receive(snapshot(Date.now() + 2_500));
    expect(client.clockOffset).toBe(2_500);
    expect(client.serverNow()).toBe(Date.now() + 2_500);
    vi.advanceTimersByTime(10_000);
    expect(client.serverNow()).toBe(Date.now() + 2_500);
    last().receive({ type: 'countdown', startsAt: Date.now() + 5_000, serverNow: Date.now() + 2_500 });
    expect(client.clockOffset).toBe(2_500);
  });

  it('con varias muestras se queda con la de menos demora (la mayor diferencia)', () => {
    const { client } = make();
    client.connect();
    last().accept();
    last().receive(snapshot(Date.now() + 2_380));
    last().receive(snapshot(Date.now() + 2_500));
    last().receive(snapshot(Date.now() + 2_450));
    expect(client.clockOffset).toBe(2_500);
  });

  it('recuerda solo las últimas 5 muestras: una diferencia vieja deja de pesar', () => {
    const { client } = make();
    client.connect();
    last().accept();
    last().receive(snapshot(Date.now() + 9_000));
    for (let i = 0; i < 5; i++) last().receive(snapshot(Date.now() + 100));
    expect(client.clockOffset).toBe(100);
  });

  it('un reloj local atrasado o adelantado da cuentas regresivas iguales para todos', () => {
    // Dos navegadores con relojes distintos calculan la misma hora de inicio del servidor.
    const startsAt = 1_005_000;
    const a = make();
    a.client.connect();
    last().accept();
    last().receive({ type: 'countdown', startsAt, serverNow: 1_000_000 });
    vi.advanceTimersByTime(1_000);
    expect(startsAt - a.client.serverNow()).toBe(4_000);
    // Otro navegador, con el reloj 3 s atrasado: el mismo cálculo da lo mismo.
    vi.setSystemTime(Date.now() - 3_000);
    const b = make();
    b.client.connect();
    last().accept();
    last().receive({ type: 'countdown', startsAt, serverNow: 1_001_000 });
    expect(startsAt - b.client.serverNow()).toBe(4_000);
  });
});

describe('interruptor general', () => {
  it('sin la variable el versus no existe', () => {
    vi.stubEnv('NEXT_PUBLIC_VERSUS_URL', '');
    expect(versusUrl()).toBeUndefined();
    expect(versusEnabled()).toBe(false);
  });

  it('con la variable, la dirección sin la barra final', () => {
    vi.stubEnv('NEXT_PUBLIC_VERSUS_URL', 'wss://animeguess-versus.lucasbutto.workers.dev/');
    expect(versusUrl()).toBe('wss://animeguess-versus.lucasbutto.workers.dev');
    expect(versusEnabled()).toBe(true);
  });
});
