import type { VersusConfig } from '../../src/versus/config';
import { encodeMessage, parseClientMessage, type ServerMessage, type Snapshot } from '../../src/versus/protocol';
import { createRoom, reduce, resolveTarget, snapshotFor, timersOf, type RoomEvent, type RoomOutput, type RoomState } from '../../src/versus/room';

// El anfitrión de una sala: lo que hace el Durable Object con el reductor, pero sin tocar nada de Cloudflare, para poder
// probarlo con una plataforma falsa (reloj, almacenamiento, alarma y conexiones inventados). El objeto real (`room.ts`) solo
// le entrega la suya. Acá se decide: cuándo guardar, cuándo programar la alarma, a quién llega cada mensaje y a quién se
// le corta la conexión.

/** Mensajes por segundo que acepta una conexión; de más, se descartan. */
export const MAX_MESSAGES_PER_SECOND = 20;
/** Conexiones abiertas a la vez en una sala: 10 jugadores y 8 espectadores, más algo de margen para reconexiones. */
export const MAX_SOCKETS = 24;

export interface HostSocket {
  readonly conn: string;
  send(text: string): void;
  close(code: number, reason: string): void;
}

export interface HostPlatform {
  now(): number;
  /** Texto hexadecimal al azar (`crypto.getRandomValues`) para cada evento. */
  entropy(): string;
  /** Un código de sala candidato (para la revancha). */
  newCode(): string;
  load(): RoomState | null;
  save(state: RoomState): void;
  /** Borra todo lo de la sala: estado y alarma. */
  wipe(): Promise<void>;
  getAlarm(): Promise<number | null>;
  setAlarm(at: number): Promise<void>;
  deleteAlarm(): Promise<void>;
  sockets(): readonly HostSocket[];
  /** Crea la sala de la revancha (otro objeto). `false` si el código ya existe o falló. */
  createRoom(code: string, state: RoomState): Promise<boolean>;
  /** Logs mínimos: sin apodos ni tokens. */
  log(event: string, data?: Readonly<Record<string, string | number | boolean>>): void;
}

type EventInput = RoomEvent extends infer E ? (E extends unknown ? Omit<E, 'entropy'> : never) : never;

export type CreateResult = { readonly ok: true; readonly playerId: string; readonly token: string } | { readonly ok: false; readonly reason: 'exists' };

export class RoomHost {
  private state: RoomState | null | undefined;
  private scheduled: number | null | undefined;
  private readonly buckets = new Map<string, { tokens: number; at: number }>();

  constructor(private readonly platform: HostPlatform) {}

  private current(): RoomState | null {
    if (this.state === undefined) this.state = this.platform.load();
    return this.state;
  }

  exists(): boolean {
    return this.current() !== null;
  }

  /** Lo que ve cualquiera de la sala (como espectador), o `null` si no existe. */
  summary(): Snapshot | null {
    const state = this.current();
    return state ? snapshotFor(state, 'http', this.platform.now()) : null;
  }

  openSockets(): number {
    return this.platform.sockets().length;
  }

  /** Crea la sala con su creador. */
  async create(input: { readonly code: string; readonly config: VersusConfig; readonly name: string }): Promise<CreateResult> {
    if (this.exists()) return { ok: false, reason: 'exists' };
    const created = createRoom({ ...input, entropy: this.platform.entropy(), now: this.platform.now() });
    await this.persist(created.state, null);
    this.platform.log('room_created', { code: input.code, partidas: input.config.partidas.length, modality: input.config.modality });
    return { ok: true, playerId: created.playerId, token: created.token };
  }

  /** Recibe una sala armada afuera (la de la revancha). */
  async adopt(state: RoomState): Promise<boolean> {
    if (this.exists()) return false;
    await this.persist(state, null);
    this.platform.log('room_created', { code: state.code, rematch: true });
    return true;
  }

  async connect(conn: string, token: string | null): Promise<void> {
    await this.dispatch({ type: 'connect', conn, ...(token ? { token } : {}) });
  }

  /** Un mensaje de una conexión: tamaño, formato y ritmo se miran antes de llegar al reductor. */
  async message(conn: string, raw: string | ArrayBuffer): Promise<void> {
    if (!this.allow(conn)) return;
    const parsed = parseClientMessage(raw);
    if (!parsed.ok) {
      this.sendTo(conn, { type: 'error', code: parsed.error });
      this.platform.log('error', { code: parsed.error });
      return;
    }
    await this.dispatch({ type: 'message', conn, message: parsed.message, ...(parsed.message.type === 'rematch' ? { newCode: this.platform.newCode() } : {}) });
  }

  async disconnect(conn: string): Promise<void> {
    this.buckets.delete(conn);
    await this.dispatch({ type: 'disconnect', conn });
  }

  /** Venció la alarma. */
  async alarm(): Promise<void> {
    this.scheduled = undefined;
    await this.dispatch({ type: 'alarm' });
  }

  private allow(conn: string): boolean {
    const now = this.platform.now();
    const bucket = this.buckets.get(conn) ?? { tokens: MAX_MESSAGES_PER_SECOND, at: now };
    bucket.tokens = Math.min(MAX_MESSAGES_PER_SECOND, bucket.tokens + ((now - bucket.at) / 1000) * MAX_MESSAGES_PER_SECOND);
    bucket.at = now;
    this.buckets.set(conn, bucket);
    if (bucket.tokens < 1) return false;
    bucket.tokens -= 1;
    return true;
  }

  private sendTo(conn: string, message: ServerMessage): void {
    const socket = this.platform.sockets().find((candidate) => candidate.conn === conn);
    if (!socket) return;
    try {
      socket.send(encodeMessage(message));
    } catch {
      // La conexión ya se estaba cerrando.
    }
  }

  private async dispatch(event: EventInput): Promise<void> {
    const before = this.current();
    if (!before) return;
    const output = reduce(before, { ...event, entropy: this.platform.entropy() } as RoomEvent, this.platform.now());
    // Los efectos van primero: si no se pudo crear la sala de la revancha, no se avisa de nada y el creador puede reintentar.
    for (const effect of output.effects) {
      if (!(await this.platform.createRoom(effect.code, effect.state))) {
        if (event.type === 'message') this.sendTo(event.conn, { type: 'error', code: 'not_allowed', message: 'No se pudo crear la revancha' });
        this.platform.log('error', { code: 'rematch_failed' });
        return;
      }
    }
    await this.persist(output.state, output);
    this.logTransitions(before, output);
    this.deliver(output);
    if (output.destroy) await this.destroy();
  }

  /** Guarda el estado y deja la alarma programada al vencimiento más cercano (una sola por objeto). */
  private async persist(state: RoomState, output: RoomOutput | null): Promise<void> {
    this.state = state;
    if (output?.destroy) return;
    this.platform.save(state);
    const next = output ? (output.alarms[0] ?? null) : (timersOf(state)[0]?.at ?? null);
    if (this.scheduled === undefined) this.scheduled = await this.platform.getAlarm();
    if (next === this.scheduled) return;
    if (next === null) await this.platform.deleteAlarm();
    else await this.platform.setAlarm(next);
    this.scheduled = next;
  }

  private deliver(output: RoomOutput): void {
    const sockets = new Map(this.platform.sockets().map((socket) => [socket.conn, socket]));
    for (const { target, message } of output.send) {
      const text = encodeMessage(message);
      if (message.type === 'error') this.platform.log('error', { code: message.code });
      for (const conn of resolveTarget(output.state, target)) {
        try {
          sockets.get(conn)?.send(text);
        } catch {
          // La conexión ya se estaba cerrando.
        }
      }
    }
    for (const conn of output.close) {
      try {
        sockets.get(conn)?.close(1000, 'bye');
      } catch {
        // Ya estaba cerrada.
      }
    }
  }

  private logTransitions(before: RoomState, output: RoomOutput): void {
    const after = output.state;
    if (before.phase !== after.phase && after.phase === 'playing') this.platform.log('room_started', { code: after.code, players: after.players.length });
    if (before.phase !== after.phase && after.phase === 'finished') this.platform.log('room_finished', { code: after.code, players: after.players.length, tiebreaks: after.round });
    if (output.destroy) this.platform.log('room_destroyed', { code: after.code });
  }

  /** La sala se borra: se cierran las conexiones que queden y se limpia el almacenamiento. */
  private async destroy(): Promise<void> {
    for (const socket of this.platform.sockets()) {
      try {
        socket.close(1000, 'room_closed');
      } catch {
        // Ya estaba cerrada.
      }
    }
    await this.platform.wipe();
    this.state = null;
    this.scheduled = null;
  }
}
