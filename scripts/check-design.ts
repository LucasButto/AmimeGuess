// npm run check:design
//
// Comprueba con Playwright lo automático del diseño (sesión 15, SPEC 9.2): la revelación por columnas del
// Clásico en las cuatro franquicias, las ayudas ⓘ, las animaciones (solo transform y opacity, fondo con 3
// capas animadas como máximo, movimiento reducido), los saltos de layout, la tipografía del tema en modales y
// ayudas, los botones de volver, las preferencias, los emojis para compartir, el fondo según la hora y que
// no se pida nada a /_next/image ni a Google Fonts. Guarda capturas en .screenshots/design/ (ignorada por git).
//
// Usa el build de producción: correr antes `npm run build`. Con BASE_URL=http://… usa un servidor ya levantado.

import { readFileSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import path from 'node:path';
import type { Browser, BrowserContext, BrowserContextOptions, Page } from 'playwright';
import { launchBrowser, startServer } from './browser.ts';
import { getDay } from '../src/engine/day.ts';
import { stateKey } from '../src/engine/storage.ts';

// El motor importa sus módulos sin extensión (como pide Next): para usar `pickDaily` desde Node, se resuelven
// esas rutas relativas agregando `.ts`.
registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch (error) {
      if (specifier.startsWith('.') && !/\.\w+$/.test(specifier)) return next(`${specifier}.ts`, context);
      throw error;
    }
  },
});
const { pickDaily } = (await import('../src/engine/daily.ts')) as typeof import('../src/engine/daily.ts');

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, '.screenshots', 'design');
const GAME_READY = '[data-game-ready="true"]';
const MAX_REVEAL_MS = 2400;
const EDGE = 8;

/** Pedidos que nunca tienen que salir del sitio (SPEC 7 y 9.2). */
const FORBIDDEN = [/\/_next\/image/, /fonts\.googleapis\.com/, /fonts\.gstatic\.com/];
const forbiddenRequests: string[] = [];

interface Ctx {
  browser: Browser;
  baseUrl: string;
}

// --- Ayudas -----------------------------------------------------------------

/** Un contexto nuevo (cookies y almacenamiento limpios) que registra los pedidos prohibidos. */
async function newContext(ctx: Ctx, options: BrowserContextOptions = {}, storage: Record<string, string> = {}): Promise<BrowserContext> {
  const context = await ctx.browser.newContext({ viewport: { width: 1366, height: 768 }, ...options });
  context.on('request', (request) => {
    if (FORBIDDEN.some((pattern) => pattern.test(request.url()))) forbiddenRequests.push(request.url());
  });
  if (Object.keys(storage).length > 0) {
    await context.addInitScript((entries) => {
      for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
    }, storage);
  }
  return context;
}

async function open(ctx: Ctx, context: BrowserContext, route: string, ready = GAME_READY): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`${ctx.baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(ready, { timeout: 30_000 });
  return page;
}

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`) });
}

const today = () => getDay(new Date());

/** Una partida guardada de hoy con estos intentos (todas las series). */
function savedGame(franchise: string, mode: string, attempts: string[], result: 'playing' | 'won' = 'playing'): Record<string, string> {
  return { [stateKey({ franchise, mode, filterKey: 'all', day: today() })]: JSON.stringify({ attempts, result }) };
}

/** La respuesta de hoy del Clásico de una franquicia con todas las series (se calcula como en el juego). */
function classicAnswer(franchise: string): string {
  const entities = JSON.parse(readFileSync(path.join(ROOT, 'data', franchise, 'entities.json'), 'utf8')) as Array<{ id: string }>;
  return pickDaily(entities, { franchise, mode: 'clasico', filterKey: 'all', day: today() }).id;
}

/** Dos entidades que no son la respuesta de hoy, para intentos que fallan. */
function misses(franchise: string, candidates: readonly string[]): string[] {
  const answer = classicAnswer(franchise);
  return candidates.filter((id) => id !== answer).slice(0, 2);
}

/** Escribe en el autocompletado y elige la primera sugerencia. */
async function guess(page: Page, text: string): Promise<void> {
  // En Pokémon el intento se elige en la Pokédex (un modal con buscador); en las demás, en un campo con sugerencias.
  const opener = page.locator('[data-picker-open]');
  if ((await opener.count()) > 0) {
    await opener.click();
    const field = page.locator('dialog[open] input[type="text"]');
    await field.fill(text);
    await field.press('Enter');
    await page.waitForSelector('dialog[open]', { state: 'detached' });
    return;
  }
  const input = page.getByRole('combobox');
  await input.fill(text);
  await page.waitForSelector('[role="option"]');
  await input.press('Enter');
}

function parseMs(value: string): number {
  const match = /^\s*(\d*\.?\d+)\s*(ms|s)\s*$/.exec(value);
  if (!match) return Number.NaN;
  return match[2] === 's' ? Number(match[1]) * 1000 : Number(match[1]);
}

// --- Chequeos -----------------------------------------------------------------

/** /pokemon: 1 tarjeta Pokédex y después 6 bolas, cada una un único enlace con nombre accesible. */
async function pokemonCards(ctx: Ctx): Promise<string[]> {
  const context = await newContext(ctx, { viewport: { width: 390, height: 844 } });
  const page = await open(ctx, context, '/pokemon', '[data-card]');
  const cards = await page.$$eval('ul[aria-label="Modos de juego"] > li', (items) =>
    items.map((item) => {
      const links = item.querySelectorAll('a');
      return { links: links.length, card: links[0]?.getAttribute('data-card'), name: links[0]?.getAttribute('aria-label') ?? '' };
    }),
  );
  await shot(page, 'pokemon-tarjetas');
  await context.close();
  const problems: string[] = [];
  if (cards.length !== 7) problems.push(`hay ${cards.length} tarjetas (se esperaban 7)`);
  if (cards[0]?.card !== 'pokedex') problems.push('la primera tarjeta no es la Pokédex');
  if (cards.slice(1).some((card) => card.card !== 'ball')) problems.push('después de la Pokédex no vienen solo bolas');
  for (const card of cards) {
    if (card.links !== 1) problems.push(`una tarjeta tiene ${card.links} enlaces`);
    if (!/^[^:]+(: (resuelto hoy|pendiente))?$/.test(card.name)) problems.push(`nombre accesible raro: "${card.name}"`);
  }
  return problems;
}

/** /dragon-ball: la cápsula del Clásico y siete esferas con 1 a 7 estrellas, cada una un único enlace con nombre accesible. */
async function dragonBallCards(ctx: Ctx): Promise<string[]> {
  const context = await newContext(ctx, { viewport: { width: 390, height: 844 } });
  const page = await open(ctx, context, '/dragon-ball', '[data-card]');
  const cards = await page.$$eval('ul[aria-label="Modos de juego"] > li', (items) =>
    items.map((item) => {
      const links = item.querySelectorAll('a');
      const svg = item.querySelector('svg');
      return {
        links: links.length,
        card: links[0]?.getAttribute('data-card'),
        name: links[0]?.getAttribute('aria-label') ?? '',
        stars: svg ? svg.querySelectorAll('polygon').length : 0,
      };
    }),
  );
  await shot(page, 'dragon-ball-tarjetas');
  await context.close();
  const problems: string[] = [];
  if (cards.length !== 8) problems.push(`hay ${cards.length} tarjetas (se esperaban 8)`);
  if (cards[0]?.card !== 'capsule') problems.push('la primera tarjeta no es la cápsula');
  const spheres = cards.slice(1);
  if (spheres.some((card) => card.card !== 'sphere')) problems.push('las siete tarjetas que siguen a la cápsula no son esferas');
  if (spheres.map((card) => card.stars).join() !== '1,2,3,4,5,6,7') problems.push(`las estrellas de las esferas son ${spheres.map((card) => card.stars).join()} y no 1 a 7`);
  for (const card of cards) {
    if (card.links !== 1) problems.push(`una tarjeta tiene ${card.links} enlaces`);
    if (!/^[^:]+(: (resuelto hoy|pendiente))?$/.test(card.name)) problems.push(`nombre accesible raro: "${card.name}"`);
  }
  return problems;
}

/** /naruto: el pergamino abierto del Clásico, el tablón de Conexiones y rollos para los demás, cada uno un único enlace con nombre accesible. */
async function narutoCards(ctx: Ctx): Promise<string[]> {
  const context = await newContext(ctx, { viewport: { width: 390, height: 844 } });
  const page = await open(ctx, context, '/naruto', '[data-card]');
  const cards = await page.$$eval('ul[aria-label="Modos de juego"] > li', (items) =>
    items.map((item) => {
      const links = item.querySelectorAll('a');
      return {
        links: links.length,
        card: links[0]?.getAttribute('data-card'),
        href: links[0]?.getAttribute('href') ?? '',
        name: links[0]?.getAttribute('aria-label') ?? '',
      };
    }),
  );
  await shot(page, 'naruto-tarjetas');
  await context.close();
  const problems: string[] = [];
  if (cards.length < 7) problems.push(`hay ${cards.length} tarjetas`);
  if (cards[0]?.card !== 'open-scroll') problems.push('la primera tarjeta no es el pergamino abierto');
  for (const card of cards.slice(1)) {
    const expected = card.href.endsWith('/conexiones') ? 'board' : 'scroll';
    if (card.card !== expected) problems.push(`${card.href}: la tarjeta es "${card.card}" y no "${expected}"`);
  }
  for (const card of cards) {
    if (card.links !== 1) problems.push(`una tarjeta tiene ${card.links} enlaces`);
    if (!/^[^:]+(: (resuelto hoy|pendiente))?$/.test(card.name)) problems.push(`nombre accesible raro: "${card.name}"`);
  }
  return problems;
}

/** Con movimiento reducido en Naruto: ni los pétalos, ni el humo, ni el tronco de las celdas se animan, y la fila queda completa enseguida. */
async function reducedMotionNaruto(ctx: Ctx): Promise<string[]> {
  const problems: string[] = [];
  const context = await newContext(ctx, { reducedMotion: 'reduce' });
  const page = await open(ctx, context, '/naruto/clasico');
  const moving = () =>
    page.evaluate(() => {
      const names = /(fall|puff|log-away|clear|unroll|stamp-in|open-page|spin)/;
      return document.getAnimations().filter((animation) => names.test((animation as CSSAnimation).animationName ?? '')).length;
    });
  if ((await moving()) > 0) problems.push('hay animaciones del tema corriendo al abrir el Clásico');
  const [miss] = misses('naruto', ['naruto-uzumaki', 'sasuke-uchiha', 'sakura-haruno']);
  await guess(page, miss);
  await page.waitForSelector('tbody tr');
  await page.waitForTimeout(400);
  if ((await moving()) > 0) problems.push('hay animaciones del tema (humo, tronco) con movimiento reducido');
  await context.close();
  return problems;
}

/**
 * Naruto: los términos (afiliaciones, tipos de jutsu, atributos, arcos) y los íconos de naturaleza abren su recuadro con el
 * foco y con un toque, sin salirse de la ventana ni quedar dentro de la tabla; Escape lo cierra. El recuadro empieza con el
 * nombre del término.
 */
async function narutoTerms(ctx: Ctx): Promise<string[]> {
  const problems: string[] = [];
  const storage = savedGame('naruto', 'clasico', misses('naruto', ['naruto-uzumaki', 'sasuke-uchiha', 'sakura-haruno']));
  for (const viewport of [
    { width: 360, height: 640 },
    { width: 1920, height: 1080 },
  ]) {
    const size = `${viewport.width}x${viewport.height}`;
    const context = await newContext(ctx, { viewport, hasTouch: true }, storage);
    const page = await open(ctx, context, '/naruto/clasico');
    await page.waitForSelector('tbody tr');
    const terms = page.locator('tbody button[type="button"]');
    const count = await terms.count();
    if (count < 10) problems.push(`${size}: solo ${count} términos con recuadro en la tabla`);
    for (const index of [0, Math.floor(count / 2), count - 1]) {
      const term = terms.nth(index);
      const name = ((await term.getAttribute('aria-label')) ?? (await term.textContent()) ?? '').trim();
      await term.scrollIntoViewIfNeeded();
      await page.keyboard.press('Shift');
      await term.focus();
      const tip = await page.evaluate((edge) => {
        const element = document.querySelector('[role="tooltip"]');
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        const width = document.documentElement.clientWidth;
        return {
          text: element.textContent ?? '',
          inside: rect.left >= edge - 0.5 && rect.top >= edge - 0.5 && rect.right <= width - edge + 0.5 && rect.bottom <= window.innerHeight - edge + 0.5,
          clipped: Boolean(element.closest('table, [role="region"]')),
        };
      }, EDGE);
      if (!tip) problems.push(`${size} "${name}": no abre con el foco`);
      else {
        if (!tip.text.startsWith(name)) problems.push(`${size} "${name}": el recuadro dice "${tip.text}"`);
        if (!tip.inside) problems.push(`${size} "${name}": el recuadro se sale de la ventana`);
        if (tip.clipped) problems.push(`${size} "${name}": el recuadro queda dentro de la tabla`);
      }
      await page.keyboard.press('Escape');
      if (await page.$('[role="tooltip"]')) problems.push(`${size} "${name}": Escape no lo cierra`);
      await term.tap();
      if (!(await page.$('[role="tooltip"]'))) problems.push(`${size} "${name}": no abre con un toque`);
      await page.keyboard.press('Escape');
    }
    if (viewport.width === 360) await shot(page, 'naruto-terminos-360');
    await context.close();
  }
  return problems;
}

/** Con las 7 esferas resueltas hoy (estado preparado) aparece el dragón con "¡Pedí un deseo!"; con una menos, no. */
async function dragonBallReward(ctx: Ctx): Promise<string[]> {
  const problems: string[] = [];
  const spheres = ['silueta', 'frase', 'borroso', 'tecnica', 'poder', 'transformacion', 'linea-de-tiempo'];
  const solved = (slugs: string[]) => Object.assign({}, ...slugs.map((slug) => savedGame('dragon-ball', slug, ['x'], 'won')));
  for (const [slugs, expected] of [
    [spheres, true],
    [spheres.slice(1), false],
  ] as const) {
    const context = await newContext(ctx, { viewport: { width: 1366, height: 768 } }, solved([...slugs]));
    const page = await open(ctx, context, '/dragon-ball', '[data-card]');
    await page.waitForTimeout(500);
    const shown = (await page.getByText('¡Pedí un deseo!').count()) > 0;
    if (shown !== expected) problems.push(`con ${slugs.length} esferas resueltas el dragón ${shown ? 'aparece' : 'no aparece'} y ${expected ? 'tenía que aparecer' : 'no tenía que aparecer'}`);
    if (expected) await shot(page, 'dragon-ball-deseo');
    await context.close();
  }
  return problems;
}

/** Tras un intento, tantas celdas girando como columnas, con retrasos crecientes y 2,4 s como mucho; al recargar, nada gira. */
function revealCheck(route: string, franchise: string, candidates: readonly string[], prefix: (id: string) => string) {
  return async (ctx: Ctx): Promise<string[]> => {
    const problems: string[] = [];
    const context = await newContext(ctx, { viewport: { width: 1366, height: 900 } });
    const page = await open(ctx, context, route);
    const [miss] = misses(franchise, candidates);
    await guess(page, prefix(miss ?? ''));
    await page.waitForSelector('[data-reveal="revealing"][data-index]');
    const info = await page.evaluate((ready) => {
      const cells = [...document.querySelectorAll<HTMLElement>('[data-reveal="revealing"][data-index]')];
      const board = document.querySelector<HTMLElement>(ready);
      return {
        columns: document.querySelectorAll('thead th').length - 1,
        delays: cells.map((cell) => getComputedStyle(cell).getPropertyValue('--reveal-delay')),
        duration: board ? getComputedStyle(board).getPropertyValue('--flip-duration') : '',
      };
    }, GAME_READY);
    await page.waitForTimeout(300);
    await shot(page, `revelacion-${franchise}-${route.split('/').pop()}`);
    const delays = info.delays.map(parseMs);
    const total = delays[delays.length - 1] + parseMs(info.duration);
    if (delays.length !== info.columns) problems.push(`${delays.length} celdas giran y hay ${info.columns} columnas`);
    if (!delays.every((delay, index) => index === 0 || delay > delays[index - 1])) problems.push(`retrasos no crecientes: ${info.delays.join(', ')}`);
    if (!(total <= MAX_REVEAL_MS)) problems.push(`la revelación dura ${total} ms (más de ${MAX_REVEAL_MS})`);

    await page.waitForFunction(() => !document.querySelector('[data-reveal="revealing"]'), null, { timeout: 5000 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('tbody tr');
    const afterReload = await page.evaluate(
      () =>
        document.querySelectorAll('[data-reveal="revealing"]').length +
        document.getAnimations().filter((animation) => /flip/.test((animation as CSSAnimation).animationName ?? '')).length,
    );
    if (afterReload > 0) problems.push('al recargar con el intento guardado hay celdas girando');
    await context.close();
    return problems;
  };
}

/** Con movimiento reducido: sin giros 3D ni fondo animado, y la fila completa en 200 ms o menos. */
async function reducedMotion(ctx: Ctx): Promise<string[]> {
  const problems: string[] = [];
  const context = await newContext(ctx, { reducedMotion: 'reduce' });
  const page = await open(ctx, context, '/pokemon/clasico');
  await page.evaluate(() => {
    const timing = { start: 0, end: 0, flips: 0 };
    (window as unknown as { __reveal: typeof timing }).__reveal = timing;
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') timing.start = performance.now();
    }, true);
    const watch = () => {
      timing.flips = Math.max(timing.flips, document.getAnimations().filter((animation) => /flip/.test((animation as CSSAnimation).animationName ?? '')).length);
      if (timing.start && !timing.end && document.querySelector('tbody tr') && !document.querySelector('[data-reveal="revealing"]')) {
        timing.end = performance.now();
      }
    };
    new MutationObserver(watch).observe(document.body, { subtree: true, childList: true, attributes: true });
  });
  const [miss] = misses('pokemon', ['gyarados', 'snorlax', 'mewtwo']);
  await guess(page, miss);
  await page.waitForFunction(() => (window as unknown as { __reveal: { end: number } }).__reveal.end > 0, null, { timeout: 3000 });
  const result = await page.evaluate(() => {
    const timing = (window as unknown as { __reveal: { start: number; end: number; flips: number } }).__reveal;
    const backdrop = document.querySelector('[data-time]');
    const backdropAnimations = document.getAnimations().filter((animation) => backdrop?.contains((animation.effect as KeyframeEffect).target as Node));
    return { elapsed: timing.end - timing.start, flips: timing.flips, backdrop: backdropAnimations.length };
  });
  await context.close();
  if (result.flips > 0) problems.push('hay giros 3D con movimiento reducido');
  if (result.backdrop > 0) problems.push(`el fondo tiene ${result.backdrop} animaciones con movimiento reducido`);
  if (result.elapsed > 200) problems.push(`la fila tarda ${Math.round(result.elapsed)} ms en quedar completa (más de 200)`);
  return problems;
}

/** Con movimiento reducido en Dragon Ball: ni el fondo, ni el escaneo, ni las líneas de velocidad ni la nube se animan, y la fila queda completa enseguida. */
async function reducedMotionDragonBall(ctx: Ctx): Promise<string[]> {
  const problems: string[] = [];
  const context = await newContext(ctx, { reducedMotion: 'reduce' });
  const page = await open(ctx, context, '/dragon-ball/clasico');
  const moving = () =>
    page.evaluate(() => {
      const names = /(drift|scan|sweep|pulse|spin|ping|pop|glint|aura)/;
      return document.getAnimations().filter((animation) => names.test((animation as CSSAnimation).animationName ?? '')).length;
    });
  if ((await moving()) > 0) problems.push('hay animaciones del tema corriendo al abrir el Clásico');
  const [miss] = misses('dragon-ball', ['oolong', 'puar', 'yajirobe']);
  await guess(page, miss);
  await page.waitForSelector('tbody tr');
  await page.waitForTimeout(400);
  if ((await moving()) > 0) problems.push('hay animaciones del tema (escaneo, onomatopeya) con movimiento reducido');
  await context.close();
  return problems;
}

/** /pokemon, /dragon-ball y /naruto durante 5 s: nada anima propiedades de layout y el fondo no tiene más de 3 capas animadas. */
async function animationProperties(ctx: Ctx): Promise<string[]> {
  const problems = new Set<string>();
  for (const route of ['/pokemon', '/dragon-ball', '/naruto']) {
    const context = await newContext(ctx);
    const page = await open(ctx, context, route, '[data-card]');
    for (let sample = 0; sample < 10; sample++) {
      const found = await sampleAnimations(page);
      for (const property of found.bad) problems.add(`${route}: se anima ${property}`);
      if (found.layers > 3) problems.add(`${route}: el fondo tiene ${found.layers} capas animadas`);
      await page.waitForTimeout(500);
    }
    await context.close();
  }
  return [...problems];
}

/** Qué propiedades de layout se están animando ahora y cuántas capas del fondo se mueven. */
async function sampleAnimations(page: Page): Promise<{ bad: string[]; layers: number }> {
  return page.evaluate(() => {
      const layout = /^(width|height|top|left|right|bottom|margin.*|padding.*|inset.*|inlineSize|blockSize)$/;
      const backdrop = document.querySelector('[data-time], [data-backdrop]');
      const layers = new Set<Element>();
      const bad: string[] = [];
      for (const animation of document.getAnimations()) {
        const effect = animation.effect as KeyframeEffect | null;
        if (!effect) continue;
        const properties = effect.getKeyframes().flatMap((frame) => Object.keys(frame));
        for (const property of properties) if (layout.test(property)) bad.push(property);
        if (effect.target && backdrop?.contains(effect.target)) layers.add(effect.target);
      }
      return { bad, layers: layers.size };
  });
}

/** Las ayudas ⓘ del Clásico de una franquicia: abren con foco, con toque y con hover; Escape cierra; enteras en la ventana. */
function infoTips(franchise: string, candidates: readonly string[]) {
  return (ctx: Ctx) => infoTipsOf(ctx, franchise, candidates);
}

async function infoTipsOf(ctx: Ctx, franchise: string, candidates: readonly string[]): Promise<string[]> {
  const problems: string[] = [];
  const route = `/${franchise}/clasico`;
  const storage = savedGame(franchise, 'clasico', misses(franchise, candidates));
  const tipBox = (page: Page) =>
    page.evaluate((edge) => {
      const tip = document.querySelector('[role="tooltip"]');
      if (!tip) return null;
      const rect = tip.getBoundingClientRect();
      const width = document.documentElement.clientWidth;
      return {
        inside: rect.left >= edge - 0.5 && rect.top >= edge - 0.5 && rect.right <= width - edge + 0.5 && rect.bottom <= window.innerHeight - edge + 0.5,
        clipped: Boolean(tip.closest('table, [role="region"]')),
      };
    }, EDGE);

  for (const viewport of [
    { width: 360, height: 640 },
    { width: 844, height: 390 },
    { width: 3840, height: 2160 },
  ]) {
    const size = `${viewport.width}x${viewport.height}`;
    const context = await newContext(ctx, { viewport, hasTouch: true }, storage);
    const page = await open(ctx, context, route);
    await page.waitForSelector('tbody tr');
    const buttons = page.locator('button[aria-label^="Ayuda"]');
    const count = await buttons.count();
    if (count < 10) problems.push(`${size}: solo ${count} ayudas ⓘ`);
    for (let index = 0; index < count; index++) {
      const button = buttons.nth(index);
      const label = await button.getAttribute('aria-label');
      // Con el foco del teclado.
      await page.keyboard.press('Shift');
      await button.focus();
      let box = await tipBox(page);
      if (!box) problems.push(`${size} ${label}: no abre con el foco`);
      await page.keyboard.press('Escape');
      if (await tipBox(page)) problems.push(`${size} ${label}: Escape no la cierra`);
      // Con un toque.
      await button.scrollIntoViewIfNeeded();
      await button.tap();
      box = await tipBox(page);
      if (!box) problems.push(`${size} ${label}: no abre con un toque`);
      else {
        if (!box.inside) problems.push(`${size} ${label}: el recuadro se sale de la ventana`);
        if (box.clipped) problems.push(`${size} ${label}: el recuadro queda dentro de la tabla`);
      }
      if (index === 4) await shot(page, `ayuda-${size}`);
      await page.keyboard.press('Escape');
    }
    await context.close();
  }

  // Con el cursor encima (un mouse): se abre tras la demora y se cierra con Escape sin moverlo.
  const context = await newContext(ctx, {}, storage);
  const page = await open(ctx, context, route);
  await page.waitForSelector('tbody tr');
  const buttons = page.locator('button[aria-label^="Ayuda"]');
  const count = await buttons.count();
  for (let index = 0; index < count; index++) {
    const button = buttons.nth(index);
    await button.scrollIntoViewIfNeeded();
    await button.hover();
    await page.waitForTimeout(250);
    if (!(await tipBox(page))) problems.push(`hover ${await button.getAttribute('aria-label')}: no abre`);
    await page.keyboard.press('Escape');
    if (await tipBox(page)) problems.push(`hover ${await button.getAttribute('aria-label')}: Escape no la cierra`);
    await page.mouse.move(0, 0);
    await page.waitForTimeout(200);
  }
  await context.close();
  return problems;
}

/** Un modal y una ayuda abiertos usan la tipografía del tema (la de --font-body). */
async function themeFont(ctx: Ctx): Promise<string[]> {
  const problems: string[] = [];
  const context = await newContext(ctx);
  const page = await open(ctx, context, '/pokemon/clasico');
  const normalize = (value: string) => value.replace(/["']/g, '').replace(/\s*,\s*/g, ',').trim();
  const body = normalize(await page.evaluate(() => getComputedStyle(document.querySelector('[data-theme-root]')!).getPropertyValue('--font-body')));
  await page.getByRole('button', { name: 'Cómo se juega' }).click();
  await page.waitForSelector('dialog[open]');
  const dialogFont = normalize(await page.evaluate(() => getComputedStyle(document.querySelector('dialog[open] p, dialog[open] li')!).fontFamily));
  if (dialogFont !== body) problems.push(`el modal usa "${dialogFont}" y no "${body}"`);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Shift');
  await page.locator('button[aria-label^="Ayuda"]').first().focus();
  await page.waitForSelector('[role="tooltip"]');
  const tipFont = normalize(await page.evaluate(() => getComputedStyle(document.querySelector('[role="tooltip"]')!).fontFamily));
  if (tipFont !== body) problems.push(`la ayuda usa "${tipFont}" y no "${body}"`);
  await context.close();
  return problems;
}

/** La suma de saltos de layout en el inicio y el Clásico de Pokémon, de Dragon Ball y de Naruto es menor a 0,05. */
async function layoutShift(ctx: Ctx): Promise<string[]> {
  const problems: string[] = [];
  for (const [route, ready] of [
    ['/pokemon', '[data-card]'],
    ['/pokemon/clasico', GAME_READY],
    ['/dragon-ball', '[data-card]'],
    ['/dragon-ball/clasico', GAME_READY],
    ['/naruto', '[data-card]'],
    ['/naruto/clasico', GAME_READY],
  ] as const) {
    const context = await newContext(ctx, { viewport: { width: 390, height: 844 } });
    await context.addInitScript(() => {
      const shifts = { total: 0 };
      (window as unknown as { __cls: typeof shifts }).__cls = shifts;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) {
          if (!entry.hadRecentInput) shifts.total += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });
    const page = await open(ctx, context, route, ready);
    await page.waitForTimeout(2500);
    const total = await page.evaluate(() => (window as unknown as { __cls: { total: number } }).__cls.total);
    if (total >= 0.05) problems.push(`${route}: suma de saltos de layout ${total.toFixed(3)}`);
    await context.close();
  }
  return problems;
}

/** Los botones de volver ocupan la misma caja en todas las páginas, y la salida del tema navega en 300 ms o menos. */
async function backNav(ctx: Ctx): Promise<string[]> {
  const problems: string[] = [];
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1366, height: 768 },
  ]) {
    const context = await newContext(ctx, { viewport });
    let reference: unknown[][] | null = null;
    // La página de la franquicia solo tiene "Inicio" (su propio botón llevaría a donde ya está); las de modo, los dos.
    for (const [route, onlyHome] of [
      ['/pokemon/clasico', false],
      ['/pokemon', true],
      ['/pokemon/silueta', false],
      ['/dragon-ball', true],
      ['/dragon-ball/clasico', false],
      ['/naruto', true],
      ['/naruto/clasico', false],
      ['/yugioh/duelista', false],
    ] as const) {
      const page = await open(ctx, context, route, 'nav[aria-label="Volver"]');
      // "Inicio": la caja entera. El de la franquicia: posición y alto (su ancho depende del nombre).
      const boxes = await page.$$eval('nav[aria-label="Volver"] a', (links) =>
        links.map((link, index) => {
          const rect = link.getBoundingClientRect();
          const box = [Math.round(rect.left), Math.round(rect.top + window.scrollY), Math.round(rect.height)];
          return index === 0 ? [...box, Math.round(rect.width)] : box;
        }),
      );
      reference ??= boxes;
      const expected = onlyHome ? reference.slice(0, 1) : reference;
      if (JSON.stringify(boxes) !== JSON.stringify(expected)) problems.push(`${viewport.width}: en ${route} los botones de volver están en ${JSON.stringify(boxes)} y no en ${JSON.stringify(expected)}`);
      await page.close();
    }
    await context.close();
  }
  // La salida del tema (la Poké Ball que se recoge, la nube que se aleja) demora la navegación 300 ms como mucho.
  for (const [route, home] of [
    ['/pokemon/clasico', /\/pokemon$/],
    ['/dragon-ball/clasico', /\/dragon-ball$/],
    ['/naruto/clasico', /\/naruto$/],
  ] as const) {
    const delay = await backNavDelay(ctx, route, home);
    if (!(delay <= 300)) problems.push(`${route}: la salida de los botones de volver demora ${Math.round(delay)} ms`);
  }
  return problems;
}

/** Cuánto pasa entre el clic en el botón de volver a la franquicia y la navegación. */
async function backNavDelay(ctx: Ctx, route: string, home: RegExp): Promise<number> {
  const context = await newContext(ctx);
  const page = await open(ctx, context, route);
  await page.evaluate(() => {
    const times = { click: 0, push: 0 };
    (window as unknown as { __nav: typeof times }).__nav = times;
    document.addEventListener('click', () => (times.click ||= performance.now()), true);
    const push = history.pushState.bind(history);
    history.pushState = (...args: Parameters<History['pushState']>) => {
      times.push ||= performance.now();
      push(...args);
    };
  });
  await page.click('nav[aria-label="Volver"] a[data-kind="franchise"]');
  await page.waitForURL(home);
  const delay = await page.evaluate(() => {
    const times = (window as unknown as { __nav: { click: number; push: number } }).__nav;
    return times.push - times.click;
  });
  await context.close();
  return delay;
}

/** Al cambiar de modo, el tema tapa la pantalla (hasta 900 ms) antes de navegar: ni sin animación ni mucho más de lo que dice. */
async function pageExit(ctx: Ctx): Promise<string[]> {
  const problems: string[] = [];
  for (const [route, target, linkName] of [
    ['/pokemon/clasico', '/pokemon/silueta', /^Silueta/],
    ['/dragon-ball/clasico', '/dragon-ball/silueta', /^Silueta/],
  ] as const) {
    const context = await newContext(ctx);
    const page = await open(ctx, context, route);
    await page.evaluate(() => {
      const times = { click: 0, push: 0 };
      (window as unknown as { __nav: typeof times }).__nav = times;
      document.addEventListener('click', () => (times.click ||= performance.now()), true);
      const push = history.pushState.bind(history);
      history.pushState = (...args: Parameters<History['pushState']>) => {
        times.push ||= performance.now();
        push(...args);
      };
    });
    await page.getByRole('link', { name: linkName }).first().click();
    await page.waitForURL(new RegExp(`${target}(\\?.*)?$`));
    const delay = await page.evaluate(() => {
      const times = (window as unknown as { __nav: { click: number; push: number } }).__nav;
      return times.push - times.click;
    });
    if (!(delay >= 250 && delay <= 1100)) problems.push(`${route} → ${target}: navega a los ${Math.round(delay)} ms (se espera la salida del tema, de 250 a 1100 ms)`);
    await context.close();
  }
  return problems;
}

/** "Fuente legible" cambia la fuente por la de sistema; con "Sonidos" apagado no se crea ningún AudioContext. */
async function preferences(ctx: Ctx): Promise<string[]> {
  const problems: string[] = [];
  const legible = await newContext(ctx, {}, { 'md:v1:prefs': JSON.stringify({ legibleFont: true, sounds: false }) });
  const page = await open(ctx, legible, '/pokemon/clasico');
  const fonts = await page.evaluate(() => [getComputedStyle(document.body).fontFamily, getComputedStyle(document.querySelector('[data-theme-root]')!).fontFamily]);
  if (fonts.some((font) => !font.includes('system-ui') || /jersey/i.test(font))) problems.push(`con "Fuente legible" la fuente es ${fonts.join(' / ')}`);
  await legible.close();

  const quiet = await newContext(ctx);
  await quiet.addInitScript(() => {
    const counter = { created: 0 };
    (window as unknown as { __audio: typeof counter }).__audio = counter;
    const Original = window.AudioContext;
    window.AudioContext = class extends Original {
      constructor(...args: ConstructorParameters<typeof AudioContext>) {
        super(...args);
        counter.created++;
      }
    };
  });
  const quietPage = await open(ctx, quiet, '/pokemon/clasico');
  const [miss] = misses('pokemon', ['gyarados', 'snorlax']);
  await guess(quietPage, miss);
  await quietPage.waitForTimeout(2800);
  const created = await quietPage.evaluate(() => (window as unknown as { __audio: { created: number } }).__audio.created);
  if (created > 0) problems.push(`con "Sonidos" apagado se crearon ${created} AudioContext`);
  await quiet.close();
  return problems;
}

/** El texto compartido usa los emojis del tema de Pokémon en Pokémon, y los de por defecto en las demás. */
async function shareEmojis(ctx: Ctx): Promise<string[]> {
  const problems: string[] = [];
  for (const [franchise, expected, unexpected] of [
    ['pokemon', '🟢', '🟩'],
    ['dragon-ball', '🟠', '🟩'],
    ['naruto', '🍥', '🟩'],
  ] as const) {
    const answer = classicAnswer(franchise);
    const candidates = { pokemon: ['gyarados', 'snorlax'], 'dragon-ball': ['oolong', 'puar'], naruto: ['naruto-uzumaki', 'sasuke-uchiha'] }[franchise];
    const [miss] = misses(franchise, candidates);
    const context = await newContext(ctx, { permissions: ['clipboard-read', 'clipboard-write'] }, savedGame(franchise, 'clasico', [miss, answer], 'won'));
    const page = await open(ctx, context, `/${franchise}/clasico`);
    await page.getByRole('button', { name: 'Compartir resultado' }).click();
    await page.waitForTimeout(200);
    const text = await page.evaluate(() => navigator.clipboard.readText());
    if (!text.includes(expected) || text.includes(unexpected)) problems.push(`${franchise}: el texto compartido no usa ${expected}:\n${text}`);
    if (franchise === 'pokemon') await shot(page, 'victoria-pokemon');
    await context.close();
  }
  return problems;
}

/** El fondo cambia de paleta en las cuatro franjas horarias y el reto del día no cambia. */
async function timeOfDay(ctx: Ctx, franchise: string, bands: ReadonlyArray<readonly [string, string]>): Promise<string[]> {
  const problems: string[] = [];
  const date = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10); // fecha de hoy en Argentina
  const seen: string[] = [];
  for (const [expected, hour] of bands) {
    const context = await newContext(ctx, { timezoneId: 'America/Argentina/Buenos_Aires' });
    const page = await context.newPage();
    await page.clock.install({ time: new Date(`${date}T${hour}:00:00-03:00`) });
    await page.goto(`${ctx.baseUrl}/${franchise}/clasico`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(GAME_READY);
    await page.waitForTimeout(200);
    const time = await page.locator('[data-time]').first().getAttribute('data-time');
    if (time !== expected) problems.push(`a las ${hour} el fondo es "${time}" y no "${expected}"`);
    seen.push((await page.locator('section[aria-label="Ayer fue"] strong').textContent()) ?? '');
    await shot(page, `hora-${franchise}-${expected}`);
    await context.close();
  }
  if (new Set(seen).size !== 1) problems.push(`el reto cambia con la hora local: ${seen.join(', ')}`);
  return problems;
}

const CHECKS: ReadonlyArray<{ name: string; run: (ctx: Ctx) => Promise<string[]> }> = [
  { name: '/pokemon: Pokédex y 6 bolas, un enlace cada una', run: pokemonCards },
  { name: '/dragon-ball: cápsula y 7 esferas numeradas, un enlace cada una', run: dragonBallCards },
  { name: '/dragon-ball: el dragón aparece con las 7 esferas resueltas hoy', run: dragonBallReward },
  { name: '/naruto: pergamino abierto, tablón y rollos, un enlace cada uno', run: narutoCards },
  { name: 'Revelación en /pokemon/clasico', run: revealCheck('/pokemon/clasico', 'pokemon', ['gyarados', 'snorlax', 'mewtwo'], (id) => id) },
  { name: 'Revelación en /dragon-ball/clasico', run: revealCheck('/dragon-ball/clasico', 'dragon-ball', ['oolong', 'puar', 'yajirobe'], (id) => id) },
  { name: 'Revelación en /naruto/clasico', run: revealCheck('/naruto/clasico', 'naruto', ['naruto-uzumaki', 'sasuke-uchiha', 'sakura-haruno'], (id) => id.split('-')[0]) },
  { name: 'Revelación en /yugioh/duelista', run: revealCheck('/yugioh/duelista', 'yugioh', ['yugi-muto', 'seto-kaiba', 'jaden-yuki'], (id) => id.split('-')[0]) },
  { name: 'Revelación en /yugioh/carta', run: cardReveal },
  { name: 'Movimiento reducido', run: reducedMotion },
  { name: 'Movimiento reducido en Dragon Ball', run: reducedMotionDragonBall },
  { name: 'Movimiento reducido en Naruto', run: reducedMotionNaruto },
  { name: 'Solo transform y opacity; fondo con 3 capas animadas como máximo', run: animationProperties },
  { name: 'Ayudas ⓘ de Pokémon', run: infoTips('pokemon', ['gyarados', 'snorlax', 'mewtwo']) },
  { name: 'Ayudas ⓘ de Dragon Ball', run: infoTips('dragon-ball', ['oolong', 'puar', 'yajirobe']) },
  { name: 'Términos e íconos con recuadro en el Clásico de Naruto', run: narutoTerms },
  { name: 'Tipografía del tema en modales y ayudas', run: themeFont },
  { name: 'Saltos de layout', run: layoutShift },
  { name: 'Botones de volver', run: backNav },
  { name: 'Salida al cambiar de modo', run: pageExit },
  { name: 'Preferencias', run: preferences },
  { name: 'Emojis para compartir', run: shareEmojis },
  {
    name: 'Fondo de Pokémon según la hora',
    run: (ctx) =>
      timeOfDay(ctx, 'pokemon', [
        ['dawn', '07'],
        ['day', '12'],
        ['dusk', '19'],
        ['night', '22'],
      ]),
  },
  {
    name: 'Fondo de Dragon Ball según la hora (tres paisajes)',
    run: (ctx) =>
      timeOfDay(ctx, 'dragon-ball', [
        ['dusk', '07'],
        ['day', '12'],
        ['dusk', '19'],
        ['night', '22'],
      ]),
  },
  {
    name: 'Fondo de Naruto según la hora (tres versiones de la aldea)',
    run: (ctx) =>
      timeOfDay(ctx, 'naruto', [
        ['dusk', '07'],
        ['day', '12'],
        ['dusk', '19'],
        ['night', '22'],
      ]),
  },
];

/** En el Clásico de cartas las respuestas salen del conjunto de cartas, no de los duelistas. */
async function cardReveal(ctx: Ctx): Promise<string[]> {
  return revealCheck('/yugioh/carta', 'yugioh', [], () => 'dark')(ctx);
}

async function main(): Promise<void> {
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });
  const server = await startServer();
  const { browser, label } = await launchBrowser();
  console.log(`Navegador: ${label}. Servidor: ${server.baseUrl}`);
  const ctx: Ctx = { browser, baseUrl: server.baseUrl };
  let failed = 0;
  try {
    for (const check of CHECKS) {
      let problems: string[];
      try {
        problems = await check.run(ctx);
      } catch (error) {
        problems = [`error: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`];
      }
      console.log(`${problems.length === 0 ? 'ok   ' : 'FALLA'} ${check.name}`);
      for (const problem of problems) console.log(`        - ${problem}`);
      if (problems.length > 0) failed++;
    }
    if (forbiddenRequests.length > 0) {
      failed++;
      console.log(`FALLA Pedidos a /_next/image o a Google Fonts:\n${[...new Set(forbiddenRequests)].map((url) => `        - ${url}`).join('\n')}`);
    } else {
      console.log('ok    Ningún pedido a /_next/image ni a Google Fonts');
    }
  } finally {
    await browser.close();
    server.stop();
  }
  console.log(`\nCapturas en ${path.relative(ROOT, OUT_DIR)}`);
  if (failed > 0) {
    console.log(`${failed} chequeo(s) con problemas.`);
    process.exit(1);
  }
}

await main();
