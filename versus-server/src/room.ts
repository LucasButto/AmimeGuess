import { DurableObject } from 'cloudflare:workers';
import { newRoomCode } from '../../src/versus/code';
import { PING, PONG } from '../../src/versus/protocol';
import type { RoomState } from '../../src/versus/room';
import type { Env } from './env';
import { MAX_SOCKETS, RoomHost, type HostSocket } from './host';
import { json, parseCreateBody } from './http';

/** Lo que guarda cada conexión para reconocerla al despertar de la hibernación. */
interface Attachment {
  readonly conn: string;
}

const hex = (bytes: number): string => [...crypto.getRandomValues(new Uint8Array(bytes))].map((byte) => byte.toString(16).padStart(2, '0')).join('');

/**
 * Una sala de versus: un Durable Object con almacenamiento SQLite. Toda la lógica está en el reductor (`src/versus/room.ts`)
 * y en `RoomHost`; acá solo está lo propio de Cloudflare: el almacenamiento, la alarma, el reloj y los WebSockets.
 *
 * Los WebSockets se aceptan con la API de hibernación (`ctx.acceptWebSocket`): mientras nadie manda nada, el objeto duerme y
 * no cobra tiempo. Nunca el `accept()` de siempre del socket: eso lo mantendría despierto todo el rato que la conexión está abierta.
 */
export class VersusRoom extends DurableObject<Env> {
  private readonly host: RoomHost;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    // Los pings se responden sin despertar al objeto.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
    this.host = new RoomHost({
      now: () => Date.now(),
      entropy: () => hex(32),
      newCode: () => newRoomCode((buffer) => crypto.getRandomValues(buffer)),
      load: () => {
        const row = ctx.storage.sql.exec<{ value: string }>('SELECT value FROM kv WHERE key = ?', 'state').toArray()[0];
        return row ? (JSON.parse(row.value) as RoomState) : null;
      },
      save: (state) => {
        ctx.storage.sql.exec('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', 'state', JSON.stringify(state));
      },
      wipe: async () => {
        await ctx.storage.deleteAlarm();
        await ctx.storage.deleteAll();
      },
      getAlarm: () => ctx.storage.getAlarm(),
      setAlarm: (at) => ctx.storage.setAlarm(at),
      deleteAlarm: () => ctx.storage.deleteAlarm(),
      sockets: () => this.sockets(),
      createRoom: async (code, state) => {
        const response = await env.VERSUS_ROOM.getByName(code).fetch('https://room/adopt', { method: 'POST', body: JSON.stringify(state) });
        return response.status === 201;
      },
      log: (event, data) => console.log(JSON.stringify({ event, ...data })),
    });
  }

  private sockets(): HostSocket[] {
    return this.ctx.getWebSockets().flatMap((socket) => {
      const attachment = socket.deserializeAttachment() as Attachment | null;
      if (!attachment) return [];
      return [{ conn: attachment.conn, send: (text: string) => socket.send(text), close: (code: number, reason: string) => socket.close(code, reason) }];
    });
  }

  /** Las rutas internas: el Worker es el único que llega acá (con el objeto de cada código de sala). */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/init') {
      const body = (await request.json()) as { code?: unknown; config?: unknown; name?: unknown };
      const parsed = parseCreateBody(JSON.stringify({ config: body.config, name: body.name }));
      if (!parsed.ok || typeof body.code !== 'string') return json({ error: 'bad_request' }, 400);
      const created = await this.host.create({ code: body.code, config: parsed.config, name: parsed.name });
      return created.ok ? json({ code: body.code, playerId: created.playerId, token: created.token }, 201) : json({ error: 'exists' }, 409);
    }
    if (request.method === 'POST' && url.pathname === '/adopt') {
      return (await this.host.adopt((await request.json()) as RoomState)) ? json({ ok: true }, 201) : json({ error: 'exists' }, 409);
    }
    if (request.method === 'GET' && url.pathname === '/summary') {
      const summary = this.host.summary();
      return summary ? json(summary) : json({ error: 'not_found' }, 404);
    }
    if (request.method === 'GET' && url.pathname === '/ws') return this.upgrade(request, url);
    return json({ error: 'not_found' }, 404);
  }

  private async upgrade(request: Request, url: URL): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response(null, { status: 426 });
    if (!this.host.exists()) return json({ error: 'not_found' }, 404);
    if (this.host.openSockets() >= MAX_SOCKETS) return json({ error: 'room_full' }, 503);
    const [client, server] = Object.values(new WebSocketPair());
    const conn = hex(4);
    server.serializeAttachment({ conn } satisfies Attachment);
    this.ctx.acceptWebSocket(server);
    await this.host.connect(conn, url.searchParams.get('token'));
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const attachment = socket.deserializeAttachment() as Attachment | null;
    if (attachment) await this.host.message(attachment.conn, message);
  }

  async webSocketClose(socket: WebSocket): Promise<void> {
    const attachment = socket.deserializeAttachment() as Attachment | null;
    if (attachment) await this.host.disconnect(attachment.conn);
  }

  async webSocketError(socket: WebSocket): Promise<void> {
    const attachment = socket.deserializeAttachment() as Attachment | null;
    if (attachment) await this.host.disconnect(attachment.conn);
  }

  async alarm(): Promise<void> {
    await this.host.alarm();
  }
}
