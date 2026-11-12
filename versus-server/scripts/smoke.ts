// Prueba de humo del servidor de salas, con el WebSocket nativo de Node. Corre contra `wrangler dev` o contra la URL publicada:
//
//   npm run smoke                                   (http://localhost:8787, partidas de 30 s)
//   npm run smoke -- https://animeguess-versus.<subdominio>.workers.dev
//   npm run smoke -- http://localhost:8787 --limit=10   (partidas de 10 s, para probar rápido)
//
// Sala 1: Contrarreloj con 2 partidas y 3 jugadores. En la primera, uno la resuelve, otro la resuelve más tarde y otro deja
// vencer el tiempo y recibe `timeUp`; en la segunda, dos la resuelven y uno deja vencer el tiempo; llega a los resultados.
// Sala 2: Contrarreloj con 1 partida donde los tres dejan vencer el tiempo: empatan en el primer puesto, votan distinto
// (ruleta), juegan la partida de desempate (la resuelve uno solo) y llegan a los resultados.
// Además: /health, un Origin ajeno (403), una sala que no existe (404) y un pedido mal formado (400).

export {};

const args = process.argv.slice(2);
const base = (args.find((arg) => !arg.startsWith('--')) ?? 'http://localhost:8787').replace(/\/$/, '');
const limitSeconds = Number(args.find((arg) => arg.startsWith('--limit='))?.slice('--limit='.length) ?? 30);
const wsBase = base.replace(/^http/, 'ws');
const LIMIT_MS = limitSeconds * 1000;
const PROTOCOL = 1;
const started = Date.now();

type Message = { type: string; [key: string]: any };

const stamp = () => `[${((Date.now() - started) / 1000).toFixed(1).padStart(5)}s]`;
const log = (text: string) => console.log(`${stamp()} ${text}`);

class Failure extends Error {}

function check(condition: unknown, text: string): asserts condition {
  if (!condition) throw new Failure(text);
  log(`✓ ${text}`);
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

class Client {
  readonly messages: Message[] = [];
  private readonly socket: WebSocket;
  private readonly waiters = new Set<() => void>();
  closed = false;

  readonly name: string;

  constructor(name: string, url: string) {
    this.name = name;
    this.socket = new WebSocket(url);
    this.socket.addEventListener('message', (event) => {
      this.messages.push(JSON.parse(String(event.data)) as Message);
      for (const wake of this.waiters) wake();
    });
    this.socket.addEventListener('close', () => {
      this.closed = true;
      for (const wake of this.waiters) wake();
    });
  }

  opened(): Promise<void> {
    if (this.socket.readyState === WebSocket.OPEN) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.socket.addEventListener('open', () => resolve(), { once: true });
      this.socket.addEventListener('error', () => reject(new Failure(`${this.name}: no se pudo abrir el WebSocket`)), { once: true });
    });
  }

  send(message: Message): void {
    this.socket.send(JSON.stringify(message));
  }

  find(type: string, predicate: (message: Message) => boolean = () => true): Message | undefined {
    return this.messages.find((message) => message.type === type && predicate(message));
  }

  /** Espera un mensaje (de los ya recibidos o de los que lleguen); falla si no llega a tiempo. */
  async waitFor(type: string, predicate: (message: Message) => boolean = () => true, timeoutMs = LIMIT_MS + 20_000): Promise<Message> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const found = this.find(type, predicate);
      if (found) return found;
      if (this.closed) throw new Failure(`${this.name}: la conexión se cerró esperando ${type}`);
      const left = deadline - Date.now();
      if (left <= 0) throw new Failure(`${this.name}: no llegó ${type} a tiempo`);
      await new Promise<void>((resolve) => {
        const wake = () => {
          this.waiters.delete(wake);
          clearTimeout(timer);
          resolve();
        };
        const timer = setTimeout(wake, Math.min(left, 1000));
        this.waiters.add(wake);
      });
    }
  }

  close(): void {
    this.socket.close();
  }
}

const clasico = { franchise: 'pokemon', mode: 'clasico', engine: 'classic', series: ['g1'], timeLimitMs: LIMIT_MS, defaultTimeLimitMs: LIMIT_MS };
const silueta = { franchise: 'naruto', mode: 'silueta', engine: 'image-reveal', series: ['naruto'], defaultTimeLimitMs: LIMIT_MS };

async function createRoom(name: string, partidas: unknown[]): Promise<{ code: string; playerId: string; token: string }> {
  const response = await fetch(`${base}/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config: { modality: 'timeAttack', partidas }, name }),
  });
  check(response.status === 201, `POST /rooms crea la sala (${response.status})`);
  return (await response.json()) as { code: string; playerId: string; token: string };
}

async function join(code: string, name: string, token?: string): Promise<Client> {
  const client = new Client(name, `${wsBase}/rooms/${code}/ws${token ? `?token=${token}` : ''}`);
  await client.opened();
  client.send({ type: 'hello', protocol: PROTOCOL, ...(token ? {} : { name }) });
  const snapshot = await client.waitFor('snapshot', () => true, 10_000);
  check(snapshot.you.spectator === false, `${name} entró a la sala ${code}`);
  return client;
}

async function startRoom(clients: Client[]): Promise<void> {
  for (const client of clients) client.send({ type: 'ready', value: true });
  await sleep(300);
  clients[0].send({ type: 'start' });
  for (const client of clients) await client.waitFor('countdown', () => true, 10_000);
  for (const client of clients) await client.waitFor('partidaStart', (message) => message.index === 1, 15_000);
  log('empezó la partida 1 para todos');
}

const solve = (index: number, attempts = 3) => ({ type: 'finish', index, won: true, attempts, grid: ['🟩🟥'], answer: { label: `Respuesta ${index}` } });

async function expectTimeUp(client: Client, index: number): Promise<void> {
  const before = Date.now();
  await client.waitFor('timeUp', (message) => message.index === index);
  const waited = Date.now() - before;
  check(true, `${client.name} recibió timeUp de la partida ${index} (esperó ${(waited / 1000).toFixed(1)} s)`);
}

async function room1(): Promise<void> {
  log('--- Sala 1: Contrarreloj, 2 partidas, 3 jugadores ---');
  const created = await createRoom('Ana', [clasico, { ...silueta, timeLimitMs: LIMIT_MS }]);
  const ana = await join(created.code, 'Ana', created.token);
  const beto = await join(created.code, 'Beto');
  const caro = await join(created.code, 'Caro');
  await startRoom([ana, beto, caro]);

  // Partida 1: Ana y Caro la resuelven; Beto deja vencer el tiempo.
  ana.send(solve(1, 2));
  await sleep(1500);
  caro.send(solve(1, 4));
  ana.send({ type: 'loaded', index: 2 });
  caro.send({ type: 'loaded', index: 2 });
  await expectTimeUp(beto, 1);
  check(!ana.find('timeUp', (message) => message.index === 1), 'Ana no recibió timeUp (la resolvió)');
  beto.send({ type: 'loaded', index: 2 });
  await ana.waitFor('partidaStart', (message) => message.index === 2, 10_000);

  // Partida 2: Ana y Beto la resuelven; Caro deja vencer el tiempo.
  ana.send(solve(2, 5));
  beto.send(solve(2, 3));
  await expectTimeUp(caro, 2);

  const results = (await ana.waitFor('results', () => true, 15_000)).results;
  check(results.modality === 'timeAttack', 'llegaron los resultados a Ana');
  check(results.table[0].playerId === created.playerId && results.table[0].place === 1, 'Ana, con el menor tiempo, quedó primera');
  check(results.tiebreakWon === false, 'no hubo desempate');
  const betoGame1 = results.partidas[0].games.find((game: Message) => game.status === 'timeUp');
  check(betoGame1?.answer === undefined || typeof betoGame1.answer.label === 'string', 'la partida vencida figura como timeUp en el detalle');
  check(results.partidas[1].games.some((game: Message) => game.status === 'timeUp'), 'Caro figura con timeUp en la partida 2');
  check(results.partidas[0].games.find((game: Message) => game.playerId === created.playerId)?.answer?.label === 'Respuesta 1', 'las respuestas aparecen recién en los resultados');
  for (const client of [beto, caro]) await client.waitFor('results', () => true, 5_000);
  check(true, 'los tres recibieron los resultados');

  // La sala terminada se puede consultar.
  const summary = await (await fetch(`${base}/rooms/${created.code}`)).json();
  check(summary.phase === 'finished' && summary.seed === undefined, 'GET /rooms/:código muestra la sala terminada sin la semilla');
  for (const client of [ana, beto, caro]) client.close();
}

async function room2(): Promise<void> {
  log('--- Sala 2: empate en el primer puesto, votos distintos y desempate ---');
  const created = await createRoom('Ana', [clasico]);
  const ana = await join(created.code, 'Ana', created.token);
  const beto = await join(created.code, 'Beto');
  const caro = await join(created.code, 'Caro');
  await startRoom([ana, beto, caro]);

  // Los tres dejan vencer el tiempo: empatan con el límite completo.
  for (const client of [ana, beto, caro]) await expectTimeUp(client, 1);
  const tiebreak = await ana.waitFor('tiebreak', () => true, 10_000);
  check(tiebreak.tiebreak.players.length === 3, 'se abrió la votación de desempate entre los 3 empatados');

  ana.send({ type: 'vote', option: { played: 1 } });
  beto.send({ type: 'vote', option: { other: silueta } });
  caro.send({ type: 'vote', option: { other: silueta } });
  const spin = (await ana.waitFor('spin', () => true, 10_000)).spin;
  const votes = spin.options.map((option: Message) => option.votes).sort();
  check(votes.length === 2 && votes[0] === 1 && votes[1] === 2, `ruleta proporcional a los votos: ${JSON.stringify(votes)}`);
  const sameSpin = (await caro.waitFor('spin', () => true, 5_000)).spin;
  check(sameSpin.winner === spin.winner, 'el resultado de la ruleta es el mismo para todos');

  const start = await ana.waitFor('tiebreakStart', () => true, 15_000);
  check(start.index === 11, 'empezó la partida de desempate (índice 11)');
  for (const client of [ana, beto, caro]) client.send({ type: 'loaded', index: 11 });
  ana.send(solve(11, 3));
  await expectTimeUp(beto, 11);
  await expectTimeUp(caro, 11);

  const results = (await ana.waitFor('results', () => true, 15_000)).results;
  check(results.tiebreakWon === true && results.table[0].playerId === created.playerId, 'Ana ganó el desempate y quedó primera');
  check(results.partidas.some((partida: Message) => partida.tiebreak === true && partida.index === 11), 'el detalle incluye la partida de desempate');
  for (const client of [ana, beto, caro]) client.close();
}

async function others(): Promise<void> {
  log('--- Rutas y protección ---');
  const health = await fetch(`${base}/health`);
  const body = (await health.json()) as { ok?: boolean; protocol?: number };
  check(health.status === 200 && body.ok === true && body.protocol === PROTOCOL, `GET /health responde ${JSON.stringify(body)}`);
  const foreign = await fetch(`${base}/health`, { headers: { Origin: 'https://ejemplo.com' } });
  check(foreign.status === 403, `un Origin ajeno recibe 403 (${foreign.status})`);
  const missing = await fetch(`${base}/rooms/ZZZZZZ`);
  check(missing.status === 404, `una sala que no existe da 404 (${missing.status})`);
  const bad = await fetch(`${base}/rooms`, { method: 'POST', body: JSON.stringify({ config: { modality: 'solo' }, name: 'Ana' }) });
  check(bad.status === 400, `un pedido mal formado da 400 (${bad.status})`);
  const noSocket = await fetch(`${base}/rooms/K7P2QX/ws`);
  check(noSocket.status === 426 || noSocket.status === 404, `/ws sin Upgrade no abre nada (${noSocket.status})`);
}

try {
  log(`Servidor: ${base} · partidas de ${limitSeconds} s`);
  await others();
  await room1();
  await room2();
  log('TODO BIEN');
  process.exit(0);
} catch (error) {
  console.error(`${stamp()} ✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
