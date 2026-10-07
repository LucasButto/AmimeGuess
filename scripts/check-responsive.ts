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
import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { chromium, type Browser } from 'playwright';
import { getDay } from '../src/engine/day.ts';
import { stateKey } from '../src/engine/storage.ts';

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

interface RouteCheck {
  /** Nombre de la carpeta de capturas. */
  name: string;
  path: string;
  /** `localStorage` a precargar antes de abrir la página (por ejemplo, una partida empezada). */
  storage?: Record<string, string>;
  /** Selector que indica que la página terminó de armarse. Sin él, se espera a que la red se aquiete. */
  ready?: string;
}

const GAME_READY = '[data-game-ready="true"]';

/** Una partida de Pokémon Clásico con 6 intentos ya hechos, para probar la tabla llena. */
function sixAttempts(filterKey: string, attempts: string[]): Record<string, string> {
  const key = stateKey({ franchise: 'pokemon', mode: 'clasico', filterKey, day: getDay(new Date()) });
  return { [key]: JSON.stringify({ attempts, result: 'playing' }) };
}

const ROUTES: RouteCheck[] = [
  { name: 'inicio', path: '/' },
  { name: 'pokemon', path: '/pokemon' },
  { name: 'pokemon-clasico', path: '/pokemon/clasico', ready: GAME_READY },
  {
    // Todas las series: 8 columnas.
    name: 'pokemon-clasico-6-intentos',
    path: '/pokemon/clasico',
    ready: GAME_READY,
    storage: sixAttempts('all', ['gyarados', 'mr-mime', 'snorlax', 'mewtwo', 'charizard', 'pikachu']),
  },
  {
    // Solo g1 y g2: aparece la columna condicional de Hábitat, 9 columnas.
    name: 'pokemon-clasico-g1g2-6-intentos',
    path: '/pokemon/clasico?s=g1.g2',
    ready: GAME_READY,
    storage: sixAttempts('g1.g2', ['gyarados', 'mr-mime', 'snorlax', 'mewtwo', 'charizard', 'pikachu']),
  },
  { name: 'dragon-ball-clasico-proximamente', path: '/dragon-ball/clasico' },
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
  viewport: (typeof VIEWPORTS)[number],
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
    // Las imágenes de la tabla cargan en diferido: se espera a que terminen antes de medir y fotografiar.
    await page.evaluate(() =>
      Promise.all(
        Array.from(document.images).map((image) =>
          image.complete ? null : new Promise((resolve) => image.addEventListener('load', resolve, { once: true })),
        ),
      ),
    );

    // Desborde horizontal de la página.
    const widths = await page.evaluate(() => ({
      window: window.innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    }));
    if (widths.document > widths.window || widths.body > widths.window) {
      problems.push(
        `desborde horizontal: la página mide ${Math.max(widths.document, widths.body)} px en una ventana de ${widths.window} px`,
      );
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
    await page.screenshot({ path: file, fullPage: true });
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
