import { PING, PONG, PROTOCOL_VERSION, encodeMessage, parseServerMessage, type ClientMessage, type ServerMessage } from '@/versus/protocol';

// El cliente WebSocket del sitio (docs/versus/04-fase-2-servidor.md, paso 2.5): conecta con el WebSocket nativo, manda,
// recibe mensajes ya validados, reconecta solo con espera creciente y corrige el reloj con la hora del servidor. No usa
// dependencias. Sin la variable `NEXT_PUBLIC_VERSUS_URL` el versus no existe (`versusEnabled()` es `false`).

/** La dirección del servidor de salas (`wss://…` o `ws://localhost:8787`), o `undefined` si el versus está apagado. */
export function versusUrl(): string | undefined {
  // Next reemplaza esta variable al compilar: tiene que escribirse así, sin desestructurar `process.env`.
  const url = process.env.NEXT_PUBLIC_VERSUS_URL;
  return url ? url.replace(/\/$/, '') : undefined;
}

/** El interruptor general: sin la variable, el versus no aparece en ningún lado. */
export function versusEnabled(): boolean {
  return versusUrl() !== undefined;
}

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'closed' | 'unavailable';

/** Por qué se cerró para siempre (sin reconectar), si fue por algo que dijo el servidor. */
export type CloseReason = 'protocol_mismatch' | 'kicked' | 'room_closed';

/** Lo mínimo que se usa de un WebSocket: así se prueba con uno falso. */
export interface SocketLike {
  readonly readyState: number;
  onopen: (() => void) | null;
  onmessage: ((event: { readonly data: unknown }) => void) | null;
  onclose: ((event: { readonly code: number }) => void) | null;
  onerror: (() => void) | null;
  send(text: string): void;
  close(): void;
}

export interface ClientOptions {
  /** La dirección del servidor, sin barra final. */
  readonly url: string;
  readonly code: string;
  /** El token guardado de esta sala, si ya se había entrado. */
  readonly token?: string;
  /** El apodo para unirse, si todavía no hay token. */
  readonly name?: string;
  /** Cómo se abre un WebSocket (por defecto, el del navegador). */
  readonly createSocket?: (url: string) => SocketLike;
}

/** Esperas entre intentos: 1, 2, 4, 8… hasta 30 segundos. */
export const BACKOFF_BASE_MS = 1_000;
export const BACKOFF_MAX_MS = 30_000;
/** Con tantos intentos seguidos sin conectar, el servidor no responde: pasa a `unavailable`. */
export const MAX_FAILURES = 5;
/** Cada cuánto se manda un ping para mantener viva la conexión (la respuesta no despierta a la sala). */
export const PING_EVERY_MS = 25_000;
/** Cuántas muestras de la diferencia de reloj se recuerdan. */
const CLOCK_SAMPLES = 5;

const OPEN = 1;

type MessageListener = (message: ServerMessage) => void;
type StatusListener = (status: ConnectionStatus) => void;

export function backoffDelay(failures: number): number {
  return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, failures));
}

export class VersusClient {
  private readonly options: ClientOptions;
  private socket: SocketLike | null = null;
  private token: string | undefined;
  private current: ConnectionStatus = 'connecting';
  private failures = 0;
  private everOpened = false;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private pingTimer: ReturnType<typeof setInterval> | undefined;
  private stopped = false;
  private reason: CloseReason | undefined;
  private readonly samples: number[] = [];
  private readonly messageListeners = new Set<MessageListener>();
  private readonly statusListeners = new Set<StatusListener>();

  constructor(options: ClientOptions) {
    this.options = options;
    this.token = options.token;
  }

  get status(): ConnectionStatus {
    return this.current;
  }

  /** Por qué se cerró, si lo dijo el servidor (versión distinta, expulsión, sala cerrada). */
  get closeReason(): CloseReason | undefined {
    return this.reason;
  }

  /** El token con el que se reconecta: el guardado o el que mandó el servidor al unirse. */
  get credentials(): string | undefined {
    return this.token;
  }

  /** Cuánto hay que sumarle al reloj local para tener la hora del servidor (ms). Sin muestras, 0. */
  get clockOffset(): number {
    // Cada muestra es `hora del servidor − hora local al recibir`: la demora de la red la achica. La mejor estimación es la
    // más grande (la de menos demora).
    return this.samples.length === 0 ? 0 : Math.max(...this.samples);
  }

  /** La hora del servidor ahora, corregida. */
  serverNow(): number {
    return Date.now() + this.clockOffset;
  }

  onMessage(listener: MessageListener): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  /** Abre la conexión (la primera vez; después, las reconexiones las hace solo). */
  connect(): void {
    this.stopped = false;
    this.open();
  }

  /** Manda un mensaje. `false` si la conexión no está abierta (el mensaje no se guarda). */
  send(message: ClientMessage): boolean {
    if (!this.socket || this.socket.readyState !== OPEN) return false;
    this.socket.send(encodeMessage(message));
    return true;
  }

  /** Cierra para siempre (salir de la sala o de la página): no reconecta. */
  close(): void {
    this.stopped = true;
    this.clearTimers();
    this.detach();
    this.setStatus('closed');
  }

  /** Después de `unavailable`: vuelve a intentar desde cero. */
  retry(): void {
    if (this.current !== 'unavailable') return;
    this.failures = 0;
    this.stopped = false;
    this.open();
  }

  // --- Por dentro ---------------------------------------------------------------------------------------------------

  private url(): string {
    const { url, code } = this.options;
    return `${url}/rooms/${code}/ws${this.token ? `?token=${encodeURIComponent(this.token)}` : ''}`;
  }

  private open(): void {
    this.clearTimers();
    this.detach();
    this.setStatus(this.everOpened || this.failures > 0 ? 'reconnecting' : 'connecting');
    let socket: SocketLike;
    try {
      socket = (this.options.createSocket ?? ((target) => new WebSocket(target) as unknown as SocketLike))(this.url());
    } catch {
      this.failed();
      return;
    }
    this.socket = socket;
    socket.onopen = () => {
      if (this.socket !== socket) return;
      this.everOpened = true;
      this.setStatus('open');
      // Con token recupera su lugar; sin token y con apodo, se une. El servidor contesta con un `snapshot`.
      socket.send(encodeMessage({ type: 'hello', protocol: PROTOCOL_VERSION, ...(this.token || !this.options.name ? {} : { name: this.options.name }) }));
      this.pingTimer = setInterval(() => {
        if (socket.readyState === OPEN) socket.send(PING);
      }, PING_EVERY_MS);
    };
    socket.onmessage = (event) => {
      if (this.socket === socket) this.receive(event.data);
    };
    socket.onclose = (event) => {
      if (this.socket !== socket) return;
      // El servidor cierra con el código normal (1000) cuando la conexión terminó a propósito (salir, expulsión, sala llena de
      // espectadores, sala cerrada): no hay nada que reconectar. Un corte de red llega con otro código.
      if (event.code === 1000) this.finish();
      else this.dropped();
    };
    socket.onerror = () => {
      // El cierre llega después: ahí se decide qué hacer.
    };
  }

  private receive(raw: unknown): void {
    if (raw === PONG) return;
    const message = parseServerMessage(raw);
    if (!message) return;
    if (message.type === 'snapshot') {
      // Llegó algo útil: la conexión anduvo, así que los fallos seguidos vuelven a cero.
      this.failures = 0;
      if (message.you.token) this.token = message.you.token;
      this.sample(message.serverNow);
    } else if (message.type === 'countdown') {
      this.sample(message.serverNow);
    } else if (message.type === 'error') {
      const reason = closingReason(message.code);
      if (reason) {
        this.reason = reason;
        this.stopped = true;
        this.clearTimers();
        this.deliver(message);
        this.detach();
        this.setStatus('closed');
        return;
      }
    }
    this.deliver(message);
  }

  private deliver(message: ServerMessage): void {
    for (const listener of [...this.messageListeners]) listener(message);
  }

  private sample(serverNow: number): void {
    this.samples.push(serverNow - Date.now());
    if (this.samples.length > CLOCK_SAMPLES) this.samples.shift();
  }

  /** El servidor cerró la conexión a propósito: se termina para siempre. */
  private finish(): void {
    this.stopped = true;
    this.clearTimers();
    this.detach();
    this.setStatus('closed');
  }

  /** Se cortó la conexión. Si había llegado a andar, se vuelve a intentar enseguida; si no, cuenta como fallo. */
  private dropped(): void {
    this.detach();
    if (this.stopped) return;
    this.failed();
  }

  private failed(): void {
    this.failures += 1;
    if (this.failures >= MAX_FAILURES) {
      this.clearTimers();
      this.setStatus('unavailable');
      return;
    }
    this.setStatus('reconnecting');
    // Una conexión que andaba y se cortó reintenta enseguida (1 s); si los intentos siguen fallando, la espera crece.
    this.retryTimer = setTimeout(() => this.open(), backoffDelay(this.failures - 1));
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.current === status) return;
    this.current = status;
    for (const listener of [...this.statusListeners]) listener(status);
  }

  private detach(): void {
    const socket = this.socket;
    this.socket = null;
    if (this.pingTimer !== undefined) clearInterval(this.pingTimer);
    this.pingTimer = undefined;
    if (!socket) return;
    socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
    try {
      socket.close();
    } catch {
      // Ya estaba cerrada.
    }
  }

  private clearTimers(): void {
    if (this.retryTimer !== undefined) clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    if (this.pingTimer !== undefined) clearInterval(this.pingTimer);
    this.pingTimer = undefined;
  }
}

/** Los errores del servidor después de los cuales no tiene sentido reconectar. */
function closingReason(code: string): CloseReason | undefined {
  switch (code) {
    case 'protocol_mismatch':
      return 'protocol_mismatch';
    case 'kicked':
      return 'kicked';
    case 'room_closed':
      return 'room_closed';
    default:
      return undefined;
  }
}
