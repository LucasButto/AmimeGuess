// npm run check:responsive
//
// Abre cada ruta registrada en los 8 viewports de referencia de la SPEC (9.1),
// falla si la página se desborda en horizontal y guarda una captura por ruta y
// viewport en .screenshots/ (ignorada por git). Además falla si hay errores en
// consola (por ejemplo de hidratación), solicitudes a /_next/image, o botones y
// enlaces de menos de 44 × 44 px en los viewports de teléfono.
//
// Usa el build de producción: correr antes `npm run build`. Levanta su propio
// servidor (`next start`) en un puerto libre; con BASE_URL=http://… usa uno ya
// levantado en vez de eso.
//
// Cada sesión que agrega pantallas suma sus rutas a ROUTES.

import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import { getDay } from '../src/engine/day.ts';
import { stateKey, statsKey } from '../src/engine/storage.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, '.screenshots');

// --- Qué se revisa ----------------------------------------------------------

/** Los 8 viewports de referencia (SPEC 9.1). */
const VIEWPORTS = [
  { name: '360x640', width: 360, height: 640 },
  { name: '390x844', width: 390, height: 844 },
  { name: '844x390', width: 844, height: 390 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '2560x1440', width: 2560, height: 1440 },
  { name: '3840x2160', width: 3840, height: 2160 },
] as const;

interface Viewport {
  name: string;
  width: number;
  height: number;
}

interface RouteCheck {
  /** Nombre de la carpeta de capturas. */
  name: string;
  path: string;
  /** `localStorage` a precargar antes de abrir la página (por ejemplo, una partida empezada). */
  storage?: Record<string, string>;
  /** Selector que indica que la página terminó de armarse. Sin él, se espera a que la red se aquiete. */
  ready?: string;
  /**
   * Pasos previos a medir y fotografiar, como abrir un modal. Puede devolver
   * problemas propios de la pantalla (por ejemplo, un modal que no ocupa todo el teléfono).
   * Con esto la captura es de lo que se ve en pantalla, no de la página entera.
   */
  before?: (page: Page, context: { phone: boolean }) => Promise<string[]>;
  /**
   * Comprobaciones propias de la pantalla que no cambian la captura (que sigue siendo
   * de la página entera): por ejemplo, que dos elementos entren juntos en la pantalla.
   */
  check?: (page: Page, context: { phone: boolean }) => Promise<string[]>;
}

const GAME_READY = '[data-game-ready="true"]';

/** Una partida de Pokémon con intentos ya hechos, para probar la tabla llena o la imagen a medio revelar. */
function seededGame(filterKey: string, attempts: string[], mode = 'clasico'): Record<string, string> {
  const key = stateKey({ franchise: 'pokemon', mode, filterKey, day: getDay(new Date()) });
  return { [key]: JSON.stringify({ attempts, result: 'playing' }) };
}

const SIX_ATTEMPTS = ['gyarados', 'mr-mime', 'snorlax', 'mewtwo', 'charizard', 'pikachu'];

/** Tres fallos con todas las series activas (1025 posibles): casi seguro que ninguno es la respuesta del día. */
const THREE_MISSES = ['gyarados', 'snorlax', 'mewtwo'];

/** Estadísticas de ejemplo con partidas ganadas y una racha vigente, para el modal de estadísticas. */
function seededStats(): Record<string, string> {
  const today = getDay(new Date());
  return {
    [statsKey('pokemon', 'clasico')]: JSON.stringify({
      played: 17,
      won: 15,
      distribution: { '3': 1, '5': 2, '6': 4, '8': 3, '9': 2, '12': 1, '16': 1, '27': 1 },
      currentStreak: 4,
      maxStreak: 9,
      lastWonDay: today,
    }),
  };
}

/** Todos los Pokémon de g6: jugados como intentos, la partida queda ganada (con una tabla larga). */
function wholeGeneration(series: string): string[] {
  const entities = JSON.parse(readFileSync(path.join(ROOT, 'data', 'pokemon', 'entities.json'), 'utf8')) as Array<{
    id: string;
    series: string[];
  }>;
  return entities.filter((entity) => entity.series.includes(series)).map((entity) => entity.id);
}

/** Abre un modal desde la barra del juego y comprueba cómo se ve en un teléfono. */
async function openDialog(page: Page, buttonName: string, { phone }: { phone: boolean }): Promise<string[]> {
  await page.getByRole('button', { name: buttonName }).click();
  await page.waitForSelector('dialog[open]');
  const box = await page.evaluate(() => {
    const dialog = document.querySelector('dialog[open]')!.getBoundingClientRect();
    const close = document.querySelector('dialog[open] footer button')!.getBoundingClientRect();
    return {
      width: dialog.width,
      height: dialog.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      closeTop: close.top,
      closeBottom: close.bottom,
    };
  });

  const problems: string[] = [];
  if (box.closeBottom > box.viewportHeight + 0.5 || box.closeTop < 0) {
    problems.push('el botón de cerrar del modal queda fuera de la pantalla');
  }
  if (phone) {
    if (Math.abs(box.width - box.viewportWidth) > 1 || Math.abs(box.height - box.viewportHeight) > 1) {
      problems.push(
        `el modal no ocupa toda la pantalla del teléfono: ${Math.round(box.width)}×${Math.round(box.height)} en ${box.viewportWidth}×${box.viewportHeight}`,
      );
    }
    // Zona del pulgar: el botón de cerrar tiene que estar en la mitad de abajo de la pantalla.
    if ((box.closeTop + box.closeBottom) / 2 < box.viewportHeight / 2) {
      problems.push('el botón de cerrar del modal no está en la mitad inferior de la pantalla (zona del pulgar)');
    }
  }
  return problems;
}

/**
 * Los modos de imagen: el marco de la imagen y el campo de texto tienen que entrar juntos en la
 * pantalla, o sea que su altura sumada no supera la de la ventana. (Para llegar hasta ahí la página
 * se desplaza: arriba van la navegación, la barra y los filtros del marco común.)
 */
async function imageFitsWithField(page: Page): Promise<string[]> {
  const box = await page.evaluate(() => {
    const field = document.querySelector('[data-game-ready] input[role="combobox"]')?.getBoundingClientRect();
    const frame = document.querySelector('[data-game-ready] img')?.parentElement?.getBoundingClientRect();
    if (!field || !frame) return null;
    return {
      top: Math.min(field.top, frame.top),
      bottom: Math.max(field.bottom, frame.bottom),
      left: frame.left,
      right: frame.right,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    };
  });
  if (!box) return ['no se encontró la imagen del reto o el campo de texto'];
  const problems: string[] = [];
  if (box.bottom - box.top > box.viewportHeight + 0.5) {
    problems.push(
      `la imagen y el campo no entran juntos en la pantalla: miden ${Math.round(box.bottom - box.top)} px y la ventana, ${box.viewportHeight} px`,
    );
  }
  if (box.left < -0.5 || box.right > box.viewportWidth + 0.5) problems.push('la imagen se sale de la pantalla en horizontal');
  return problems;
}

/**
 * Ids de Pokémon que nunca pueden ser la respuesta de un modo de pista de texto porque no tienen
 * contenido de ese tipo: fallos seguros para sembrar una partida a medias, sea cual sea el día.
 */
function neverAnswers(contentKind: string, count: number): string[] {
  const read = (file: string) => JSON.parse(readFileSync(path.join(ROOT, 'data', 'pokemon', file), 'utf8')) as unknown[];
  const entities = read('entities.json') as Array<{ id: string }>;
  const contents = read('content.json') as Array<{ kind: string; entityId?: string }>;
  const withContent = new Set(contents.filter((content) => content.kind === contentKind).map((content) => content.entityId));
  return entities.filter((entity) => !withContent.has(entity.id)).slice(0, count).map((entity) => entity.id);
}

/** Con una combinación de filtros que no alcanza el pool mínimo, el marco muestra el aviso y no monta el juego. */
async function showsPoolWarning(page: Page): Promise<string[]> {
  const state = await page.evaluate(() => ({
    game: document.querySelector('[data-game-ready]') !== null,
    warning: document.body.innerText.includes('hacen falta al menos'),
  }));
  const problems: string[] = [];
  if (state.game) problems.push('se montó el juego aunque la combinación no alcanza el pool mínimo');
  if (!state.warning) problems.push('no aparece el aviso de que no alcanza el pool mínimo');
  return problems;
}

/** Los modos de Pokémon que usan el motor de pista de texto (sesión 06) y el tipo de contenido de cada uno. */
const TEXT_MODES = [
  { slug: 'descripcion', contentKind: 'dex' },
  { slug: 'movimiento-insignia', contentKind: 'signature-move' },
] as const;

/** Los modos de Pokémon que usan el motor de imagen (sesión 05). */
const IMAGE_MODES = [{ slug: 'silueta' }, { slug: 'zoom' }, { slug: 'carta' }] as const;

const ROUTES: RouteCheck[] = [
  { name: 'inicio', path: '/' },
  { name: 'pokemon', path: '/pokemon' },
  { name: 'pokemon-clasico', path: '/pokemon/clasico', ready: GAME_READY },
  {
    // Todas las series: 8 columnas.
    name: 'pokemon-clasico-6-intentos',
    path: '/pokemon/clasico',
    ready: GAME_READY,
    storage: seededGame('all', SIX_ATTEMPTS),
  },
  {
    // Solo g1 y g2: aparece la columna condicional de Hábitat, 9 columnas.
    name: 'pokemon-clasico-g1g2-6-intentos',
    path: '/pokemon/clasico?s=g1.g2',
    ready: GAME_READY,
    storage: seededGame('g1.g2', SIX_ATTEMPTS),
  },
  {
    // Partida ganada (se jugaron las 72 de g6): resumen, compartir y una tabla larga.
    name: 'pokemon-clasico-victoria',
    path: '/pokemon/clasico?s=g6',
    ready: GAME_READY,
    storage: { ...seededGame('g6', wholeGeneration('g6')), ...seededStats() },
  },
  {
    name: 'pokemon-clasico-ayuda',
    path: '/pokemon/clasico',
    ready: GAME_READY,
    before: (page, context) => openDialog(page, 'Cómo se juega', context),
  },
  {
    name: 'pokemon-clasico-estadisticas',
    path: '/pokemon/clasico',
    ready: GAME_READY,
    storage: seededStats(),
    before: (page, context) => openDialog(page, 'Estadísticas', context),
  },
  {
    name: 'pokemon-clasico-estadisticas-vacias',
    path: '/pokemon/clasico',
    ready: GAME_READY,
    before: (page, context) => openDialog(page, 'Estadísticas', context),
  },
  { name: 'dragon-ball-clasico-proximamente', path: '/dragon-ball/clasico' },
  ...IMAGE_MODES.flatMap(({ slug }) => [
    { name: `pokemon-${slug}`, path: `/pokemon/${slug}`, ready: GAME_READY, check: imageFitsWithField },
    {
      // A medio revelar: tres pasos más de la imagen.
      name: `pokemon-${slug}-3-fallos`,
      path: `/pokemon/${slug}`,
      ready: GAME_READY,
      storage: seededGame('all', THREE_MISSES, slug),
      check: imageFitsWithField,
    },
    {
      // Partida ganada (se jugaron las 72 de g6): la imagen entera y el resumen del marco.
      name: `pokemon-${slug}-victoria`,
      path: `/pokemon/${slug}?s=g6`,
      ready: GAME_READY,
      storage: seededGame('g6', wholeGeneration('g6'), slug),
    },
  ]),
  ...TEXT_MODES.flatMap(({ slug, contentKind }) => [
    { name: `pokemon-${slug}`, path: `/pokemon/${slug}`, ready: GAME_READY },
    {
      // Con 6 fallos ya se desbloquearon todas las pistas.
      name: `pokemon-${slug}-6-fallos`,
      path: `/pokemon/${slug}`,
      ready: GAME_READY,
      storage: seededGame('all', neverAnswers(contentKind, 6), slug),
    },
    {
      // Partida ganada (se jugaron las 72 de g6): todas las pistas abiertas y el resumen del marco.
      name: `pokemon-${slug}-victoria`,
      path: `/pokemon/${slug}?s=g6`,
      ready: GAME_READY,
      storage: seededGame('g6', wholeGeneration('g6'), slug),
    },
  ]),
  // Movimiento insignia con solo g3 (6 posibles) y Descripción con solo g9 (ninguna): no alcanzan el mínimo.
  { name: 'pokemon-movimiento-insignia-sin-pool', path: '/pokemon/movimiento-insignia?s=g3', check: showsPoolWarning },
  { name: 'pokemon-descripcion-sin-pool', path: '/pokemon/descripcion?s=g9', check: showsPoolWarning },
];

/** Tamaño mínimo de lo que se toca (SPEC 9.1, "Móvil"). */
const TOUCH_TARGET_PX = 44;

// --- Servidor y navegador ---------------------------------------------------

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as net.AddressInfo;
      probe.close(() => resolve(port));
    });
  });
}

async function waitForServer(baseUrl: string, child: ChildProcess | null, log: () => string): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child && child.exitCode !== null) throw new Error(`El servidor se cerró al arrancar:\n${log()}`);
    try {
      if ((await fetch(baseUrl)).ok) return;
    } catch {
      // Todavía no escucha.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`El servidor no respondió en 60 s:\n${log()}`);
}

async function startServer(): Promise<{ baseUrl: string; stop: () => void }> {
  if (process.env.BASE_URL) {
    const baseUrl = process.env.BASE_URL.replace(/\/$/, '');
    await waitForServer(baseUrl, null, () => '');
    return { baseUrl, stop: () => {} };
  }

  if (!existsSync(path.join(ROOT, '.next', 'BUILD_ID'))) {
    throw new Error('No hay build de producción. Ejecutá `npm run build` y volvé a correr este comando.');
  }

  const port = await freePort();
  const nextBin = path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
  const child = spawn(process.execPath, [nextBin, 'start', '-p', String(port)], { cwd: ROOT });
  let output = '';
  child.stdout.on('data', (chunk) => (output += String(chunk)));
  child.stderr.on('data', (chunk) => (output += String(chunk)));

  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await waitForServer(baseUrl, child, () => output);
  } catch (error) {
    child.kill();
    throw error;
  }
  return { baseUrl, stop: () => child.kill() };
}

/** El Chromium de Playwright si está instalado; si no, el Chrome o el Edge del sistema. */
async function launchBrowser(): Promise<{ browser: Browser; label: string }> {
  const candidates = [
    { label: 'Chromium de Playwright', options: {} },
    { label: 'Google Chrome', options: { channel: 'chrome' } },
    { label: 'Microsoft Edge', options: { channel: 'msedge' } },
  ];
  for (const candidate of candidates) {
    try {
      return { browser: await chromium.launch({ headless: true, ...candidate.options }), label: candidate.label };
    } catch {
      // Se prueba el siguiente.
    }
  }
  throw new Error('No se encontró ningún navegador. Instalá uno con `npx playwright install chromium`.');
}

// --- Revisión de una página -------------------------------------------------

interface Result {
  problems: string[];
}

async function checkPage(
  browser: Browser,
  baseUrl: string,
  route: RouteCheck,
  viewport: Viewport,
): Promise<Result> {
  const phone = Math.min(viewport.width, viewport.height) < 500;
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    isMobile: phone,
    hasTouch: phone,
  });
  const problems: string[] = [];

  try {
    if (route.storage) {
      await context.addInitScript((entries: Record<string, string>) => {
        for (const [key, value] of Object.entries(entries)) window.localStorage.setItem(key, value);
      }, route.storage);
    }

    const page = await context.newPage();
    page.on('pageerror', (error) => problems.push(`error de página: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const url = message.location().url;
      // El sitio todavía no tiene favicon (llega con los metadatos, sesión 14): su 404 es ruido.
      if (url.endsWith('/favicon.ico')) return;
      problems.push(`error en consola: ${message.text()}${url ? ` (${url})` : ''}`);
    });
    page.on('request', (request) => {
      if (request.url().includes('/_next/image')) problems.push(`solicitud a /_next/image: ${request.url()}`);
    });

    await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'load' });
    if (route.ready) await page.waitForSelector(route.ready, { timeout: 20_000 });
    else await page.waitForLoadState('networkidle');
    // Las imágenes cargan en diferido y las que están fuera de la vista (filas de una tabla larga)
    // no cargarían nunca: se piden todas y se espera a que terminen, con un tope de tiempo.
    await page.evaluate(
      (limitMs: number) =>
        Promise.race([
          Promise.all(
            Array.from(document.images).map((image) => {
              image.loading = 'eager';
              return image.complete
                ? null
                : new Promise((resolve) => {
                    image.addEventListener('load', resolve, { once: true });
                    image.addEventListener('error', resolve, { once: true });
                  });
            }),
          ),
          new Promise((resolve) => setTimeout(resolve, limitMs)),
        ]),
      10_000,
    );

    // Pasos propios de la pantalla (abrir un modal…), antes de medir y fotografiar.
    if (route.before) problems.push(...(await route.before(page, { phone })));
    if (route.check) problems.push(...(await route.check(page, { phone })));

    // Desborde horizontal de la página.
    const widths = await page.evaluate(() => ({
      window: window.innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    }));
    // Se compara contra el ancho del viewport que se pidió, no contra `window.innerWidth`: en un
    // teléfono, si el contenido no cabe el navegador ensancha la ventana (el ancho de layout) y
    // la página y la ventana crecen juntas, así que comparar entre sí no detectaría nada.
    const measured = Math.max(widths.document, widths.body, widths.window);
    if (measured > viewport.width) {
      problems.push(`desborde horizontal: la página mide ${measured} px en un viewport de ${viewport.width} px`);
    }

    // Lo que se toca, en teléfono: al menos 44 × 44 px.
    if (phone) {
      const small = await page.evaluate((minimum: number) => {
        const targets = document.querySelectorAll<HTMLElement>('button, a[href], [role="option"]');
        const found: string[] = [];
        for (const element of targets) {
          const box = element.getBoundingClientRect();
          if (box.width === 0 || box.height === 0) continue;
          if (box.width < minimum - 0.5 || box.height < minimum - 0.5) {
            const label = (element.textContent ?? '').trim().slice(0, 30) || element.tagName.toLowerCase();
            found.push(`"${label}" mide ${Math.round(box.width)}×${Math.round(box.height)} px`);
          }
        }
        return found;
      }, TOUCH_TARGET_PX);
      problems.push(...small.map((text) => `área táctil chica: ${text}`));
    }

    const file = path.join(OUT_DIR, route.name, `${viewport.name}.png`);
    await mkdir(path.dirname(file), { recursive: true });
    // Con un modal abierto se fotografía lo que se ve en pantalla; el resto, la página entera.
    await page.screenshot({ path: file, fullPage: !route.before });
  } catch (error) {
    problems.push(`no se pudo revisar: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await context.close();
  }

  return { problems };
}

// --- Programa ---------------------------------------------------------------

async function main(): Promise<void> {
  await rm(OUT_DIR, { recursive: true, force: true });
  const server = await startServer();
  let browser: Browser | undefined;

  try {
    const launched = await launchBrowser();
    browser = launched.browser;
    console.log(`Navegador: ${launched.label}. Servidor: ${server.baseUrl}`);
    console.log(`Revisando ${ROUTES.length} rutas en ${VIEWPORTS.length} viewports…\n`);

    const failures: string[] = [];
    const grid: string[] = [];
    const nameWidth = Math.max(...ROUTES.map((route) => route.name.length));
    grid.push(`${'ruta'.padEnd(nameWidth)}  ${VIEWPORTS.map((viewport) => viewport.name.padStart(9)).join(' ')}`);

    for (const route of ROUTES) {
      const cells: string[] = [];
      for (const viewport of VIEWPORTS) {
        const { problems } = await checkPage(browser, server.baseUrl, route, viewport);
        cells.push((problems.length === 0 ? 'ok' : 'FALLA').padStart(9));
        for (const problem of new Set(problems)) failures.push(`${route.name} @ ${viewport.name}: ${problem}`);
      }
      grid.push(`${route.name.padEnd(nameWidth)}  ${cells.join(' ')}`);
    }

    console.log(grid.join('\n'));
    console.log(`\nCapturas en ${path.relative(ROOT, OUT_DIR)}${path.sep}`);

    if (failures.length > 0) {
      console.error(`\n${failures.length} problema(s):`);
      for (const failure of failures) console.error(`  - ${failure}`);
      process.exitCode = 1;
    } else {
      console.log('\nTodo en orden.');
    }
  } finally {
    await browser?.close();
    server.stop();
  }
}

main().catch((error: unknown) => {
  console.error(`\nERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
