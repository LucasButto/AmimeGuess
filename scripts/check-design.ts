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
import { filtersKey, stateKey } from '../src/engine/storage.ts';

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
const { yesterday } = (await import('../src/engine/daily.ts')) as typeof import('../src/engine/daily.ts');
const { eligibleEntities, buildFilterKey } = (await import('../src/engine/filters.ts')) as typeof import('../src/engine/filters.ts');

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

/** Campo propio: once enlaces, foco en Duelista primero, zonas y controles en los ocho tamaños. */
async function yugiohField(ctx: Ctx): Promise<string[]> {
  const problems: string[] = [];
  const slugs = ['duelista', 'carta', 'silueta', 'texto', 'arte', 'carta-insignia', 'zoom', 'mayor-o-menor', 'invocacion', 'deck', 'linea-de-tiempo'];
  for (const viewport of [
    { width: 320, height: 640 }, { width: 360, height: 640 }, { width: 390, height: 844 },
    { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 1024, height: 768 },
    { width: 1366, height: 768 }, { width: 1920, height: 1080 },
    { width: 2560, height: 1440 }, { width: 3840, height: 2160 },
  ]) {
    const context = await newContext(ctx, { viewport, reducedMotion: 'reduce' }, savedGame('yugioh', 'duelista', ['yugi-muto'], 'won'));
    // Se inyecta antes de React para observar unknown → pending/solved, sin manipular el estado de React.
    await context.addInitScript(() => {
      const samples: { state: string; mode: string; x: number; y: number; width: number; height: number }[][] = [];
      Object.assign(window, { __yugiohCardSamples: samples });
      const observer = new MutationObserver(() => {
        const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-card="duel"]'));
        if (!cards.length) return;
        samples.push(cards.map((card) => {
          const box = card.getBoundingClientRect();
          return { state: card.dataset.state ?? '', mode: card.dataset.mode ?? '', x: box.x, y: box.y, width: box.width, height: box.height };
        }));
      });
      observer.observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-state'] });
      window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
    });
    const page = await open(ctx, context, '/yugioh', '[data-card="duel"][data-state="solved"]');
    await page.waitForSelector('[data-field-controls]');
    await page.evaluate(() => document.fonts.ready);
    const cards = await page.$$eval('ul[aria-label="Modos de juego"] > li', (items) => items.map((item) => {
      const links = item.querySelectorAll('a');
      const link = links[0];
      const box = link?.getBoundingClientRect() ?? item.getBoundingClientRect();
      const surface = link?.querySelector('[data-frame]')?.firstElementChild;
      return { links: links.length, card: link?.getAttribute('data-card'), mode: link?.getAttribute('data-mode'),
        label: link?.getAttribute('aria-label'), state: link?.getAttribute('data-state'),
        name: link?.querySelector('[data-card-name]')?.textContent,
        border: surface ? parseFloat(getComputedStyle(surface).borderTopWidth) : 0,
        text: link?.textContent ?? '', x: box.x, y: box.y, width: box.width, height: box.height };
    }));
    if (cards.length !== 11 || cards.some((card, i) => card.mode !== slugs[i])) problems.push(viewport.width + ': orden de modos distinto de config.ts');
    for (const card of cards) {
      if (card.links !== 1 || card.card !== 'duel' || !card.label?.trim()) problems.push(card.mode + ': falta enlace único y nombre accesible');
      const expectedLabel = `${card.name}: ${card.state === 'solved' ? 'resuelto hoy' : 'pendiente'}${card.mode === 'duelista' ? '. Duelo principal' : ''}`;
      if (card.label !== expectedLabel) problems.push(card.mode + ': nombre accesible distinto de modo y estado');
      if (card.width < 44 || card.height < 44) problems.push(card.mode + ': objetivo táctil insuficiente');
      const expectedHeight = card.width * (viewport.width < 480 ? 90 / 59 : 86 / 59);
      if (Math.abs(card.height - expectedHeight) > 2) problems.push(card.mode + ': proporción de carta incorrecta');
      if (/ATK|DEF|MAXIMUM ATK|LINK\s*[/0-9]/.test(card.text)) problems.push(card.mode + ': estadísticas ornamentales prohibidas');
    }
    if (!cards[0]?.text.includes('Resuelto hoy')) problems.push('Duelista resuelto sin estado textual');
    const pending = await page.locator('[data-card="duel"][data-state="pending"] [data-card-status]').allInnerTexts();
    if (pending.length !== 10 || pending.some((text) => !text.includes('Pendiente'))) problems.push('faltan estados pendientes');
    for (let i = 1; i < cards.length; i++) {
      const previous = cards[i - 1], current = cards[i];
      if (current.y < previous.y - 2 || (Math.abs(current.y - previous.y) <= 2 && current.x <= previous.x)) problems.push(viewport.width + ': orden visual distinto del DOM');
    }
    const primary = cards[0], ordinary = cards[1];
    if (primary && ordinary && primary.border <= ordinary.border) problems.push(viewport.width + ': Duelista sin filete reforzado');
    if (primary && cards.some((card) => Math.abs(card.width - primary.width) > 2 || Math.abs(card.height - primary.height) > 2)) problems.push(viewport.width + ': las once cartas no tienen el mismo tamaño');
    const rowStarts: number[] = [];
    for (const card of cards) if (!rowStarts.some((y) => Math.abs(y - card.y) <= 2)) rowStarts.push(card.y);
    const columns = viewport.width >= 1440 ? 6 : viewport.width >= 1024 ? 4 : viewport.width >= 768 ? 3 : 2;
    if (rowStarts.length !== Math.ceil(11 / columns) || rowStarts.some((y, index) => cards.filter((card) => Math.abs(card.y - y) <= 2).length !== Math.min(columns, 11 - index * columns))) problems.push(viewport.width + ': columnas o filas incorrectas');
    const overflowing = await page.locator('[data-card="duel"] [data-card-paper], [data-card="duel"] [data-card-name]').evaluateAll((regions) => regions.some((region) => region.scrollHeight > region.clientHeight + 1 || region.scrollWidth > region.clientWidth + 1));
    if (overflowing) problems.push(viewport.width + ': texto fuera de su región de carta');
    const descriptions = await page.locator('[data-card-description]').evaluateAll((items) => items.some((item) => {
      const style = getComputedStyle(item);
      return item.scrollHeight > parseFloat(style.lineHeight) * 2 + 1 || parseFloat(style.fontSize) < parseFloat(getComputedStyle(document.documentElement).fontSize) * 0.75;
    }));
    if (descriptions) problems.push(viewport.width + ': descripción de más de dos líneas o texto demasiado pequeño');
    if (viewport.width >= 768 && viewport.width < 1440) {
      const aligned = await page.evaluate(() => {
        const main = document.querySelector('main')!;
        const x = main.getBoundingClientRect().left + parseFloat(getComputedStyle(main).paddingInlineStart);
        const grid = document.querySelector('ul[aria-label="Modos de juego"]')!.getBoundingClientRect();
        const controls = document.querySelector('[data-field-controls]')!.getBoundingClientRect();
        return Math.abs(grid.left - x) < 2 && Math.abs(controls.left - x) < 2;
      });
      if (!aligned) problems.push(viewport.width + ': grilla o controles desalineados del contenido');
    }
    // Los vectores externos se usan exclusivamente como máscaras dentro de los pilares.
    if (await page.locator('[data-zone], [data-backdrop="yugioh"] svg, [data-backdrop="yugioh"] rect, [data-torch-light]').count()) problems.push('quedan zonas, rectángulos de tablero o antorchas en el fondo');
    if (await page.locator('[data-backdrop="yugioh"] [data-temple-pillar]').count() !== 2) problems.push('faltan pilares del templo');
    const architecture = await page.locator('[data-backdrop="yugioh"]').evaluate((backdrop) => {
      const page = document.querySelector('main')!;
      const pageBox = page.getBoundingClientRect();
      const pageStyle = getComputedStyle(page);
      const contentLeft = pageBox.left + parseFloat(pageStyle.paddingInlineStart);
      const contentRight = pageBox.right - parseFloat(pageStyle.paddingInlineEnd);
      const allowed = new Set(['01', '08', '14', '09', '22', '23']);
      const glyphs = Array.from(backdrop.querySelectorAll('[data-glyph]'));
      const visible = glyphs.filter((glyph) => glyph.getBoundingClientRect().width > 0);
      const glyphError = glyphs.some((glyph) => {
        const id = glyph.getAttribute('data-glyph') ?? '';
        if (glyph.getAttribute('aria-hidden') !== 'true' || !allowed.has(id)) return true;
        const box = glyph.getBoundingClientRect();
        if (!box.width) return false;
        const pillar = glyph.closest('[data-temple-pillar]')!.getBoundingClientRect();
        return box.left < pillar.left - 1 || box.right > pillar.right + 1 || box.top < pillar.top - 1 || box.bottom > pillar.bottom + 1 || box.width < pillar.width * 0.6 || box.width > pillar.width * 0.7 || !getComputedStyle(glyph).maskImage.includes('/theme/yugioh/glifos/glifo-' + id + '.svg');
      });
      return { animated: backdrop.getAnimations({ subtree: true }).length > 0,
        glyphError: glyphError || (innerWidth >= 1440 ? visible.length !== 16 : visible.length !== 0),
        overlaps: Array.from(backdrop.querySelectorAll('[data-temple-pillar]')).some((pillar) => {
          const box = pillar.getBoundingClientRect();
          return pillar.getAttribute('data-side') === 'left' ? box.right > contentLeft + 1 : box.left < contentRight - 1;
        }) };
    });
    if (architecture.animated || architecture.overlaps || architecture.glyphError) problems.push(viewport.width + ': fondo animado, glifos incorrectos o pilares fuera del margen');
    const solvedDecoration = await page.locator('[data-card="duel"][data-primary="true"]').evaluate((card) => getComputedStyle(card, '::before').content);
    if (!['none', 'normal'].includes(solvedDecoration)) problems.push('Duelista resuelto conserva resplandor exterior');
    if (await page.locator('[data-card="duel"][data-state="solved"] [data-solved-seal]').count() !== 1 || await page.locator('[data-card="duel"][data-state="pending"] [data-solved-seal]').count()) problems.push('sello de victoria ausente o visible en pendientes');
    const seals = await page.locator('[data-card="duel"][data-state="solved"] [data-seal-glyph]').evaluateAll((items) => items.map((item) => ({
      id: item.getAttribute('data-seal-glyph'), hidden: item.getAttribute('aria-hidden'), mask: getComputedStyle(item).maskImage,
      color: getComputedStyle(item).backgroundColor, visible: getComputedStyle(item).visibility,
    })));
    if (seals.length !== 2 || seals.some((seal) => seal.id !== '14' || seal.hidden !== 'true' || !seal.mask.includes('/theme/yugioh/glifos/glifo-14.svg') || seal.color !== 'rgb(241, 207, 120)' || seal.visible !== 'visible')) problems.push('los dos sellos resueltos no usan el escarabajo real dorado');
    if (await page.locator('[data-card="duel"][data-state="pending"] [data-seal-glyph], [data-solved-seal] svg, [data-card-status] svg').count()) problems.push('quedan sellos dibujados o glifos de victoria en pendientes');
    const stamp = await page.locator('[data-solved-seal]').boundingBox();
    const rem = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    if (!stamp || stamp.width < 3 * rem - 1) problems.push('sello de victoria demasiado pequeño');
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) problems.push(viewport.width + ': desborde horizontal');
    const hydration = await page.evaluate(() => {
      const samples = (window as unknown as { __yugiohCardSamples: { state: string; mode: string; x: number; y: number; width: number; height: number }[][] }).__yugiohCardSamples;
      const before = samples?.find((sample) => sample.length === 11 && sample.every((card) => card.state === 'unknown'));
      const after = samples?.find((sample) => sample.length === 11 && sample.every((card) => card.state !== 'unknown'));
      if (!before || !after) return 'No se pudo observar la transición de hidratación';
      if (before.some((card, i) => ['x', 'y', 'width', 'height'].some((key) => Math.abs(card[key as 'x'] - after[i][key as 'x']) > 2))) return 'Salto de layout al leer progreso';
      return null;
    });
    if (hydration) problems.push(viewport.width + ': ' + hydration);
    const animated = await page.locator('[data-card="duel"]').evaluateAll((cards) => cards.some((card) => card.getAnimations({ subtree: true }).length > 0));
    if (animated) problems.push('cartas animadas con movimiento reducido');
    await context.close();
    // Un contexto limpio evita que el script de siembra reponga la victoria al recargar.
    const pendingContext = await newContext(ctx, { viewport, reducedMotion: 'reduce' });
    const pendingPage = await open(ctx, pendingContext, '/yugioh', '[data-card="duel"][data-primary="true"][data-state="pending"]');
    await pendingPage.evaluate(() => document.fonts.ready);
    const main = pendingPage.locator('[data-card="duel"][data-primary="true"]');
    if (!await main.locator('[data-card-status]').innerText().then((text) => text.includes('Pendiente'))) problems.push('Duelista pendiente sin texto');
    if (!await main.evaluate((card) => ['none', 'normal'].includes(getComputedStyle(card, '::before').content))) problems.push('Duelista pendiente conserva resplandor exterior');
    await shot(pendingPage, 'yugioh-cartas-' + viewport.width + 'x' + viewport.height);
    await pendingContext.close();
  }
  return problems;
}

/** El Cementerio coincide con Duelista para cada filtro guardado; Campo guarda en la misma clave. */
async function yugiohGraveyard(ctx: Ctx): Promise<string[]> {
  const problems: string[] = [];
  const canonical = ['dm', 'gx', '5ds'];
  const entities = JSON.parse(readFileSync(path.join(ROOT, 'data/yugioh/entities.json'), 'utf8')) as Array<{ id: string; name: { es: string }; series: string[] }>;
  for (const active of [canonical, ['dm'], ['gx'], ['5ds'], ['dm', 'gx'], ['dm', '5ds'], ['gx', '5ds']]) {
    const filterKey = buildFilterKey(active, canonical);
    const context = await newContext(ctx, {}, { [filtersKey('yugioh')]: JSON.stringify(active) });
    const page = await open(ctx, context, '/yugioh', '[data-field-control="graveyard"]');
    // La misma fecha del navegador, incluso si el check cruza el reinicio diario.
    const now = await page.evaluate(() => Date.now());
    const expected = yesterday(eligibleEntities(entities, active), { franchise: 'yugioh', mode: 'duelista', filterKey, day: getDay(new Date(now)) });
    await page.locator('[data-field-control="graveyard"]').click();
    const answer = page.locator('[data-graveyard-answer]');
    if (await answer.getAttribute('data-graveyard-answer') !== expected.id || !(await answer.innerText()).includes(expected.name.es)) problems.push(`${filterKey}: el Cementerio no coincide con yesterday de Duelista`);
    await page.keyboard.press('Escape');
    await page.locator('[data-field-control="field"]').click();
    const target = active.includes('gx') && active.length > 1 ? 'gx' : active.includes('dm') ? 'gx' : 'dm';
    await page.getByRole('button', { name: target === 'gx' ? 'GX' : 'Duel Monsters', exact: true }).click();
    const next = canonical.filter((id) => id === target ? !active.includes(id) : active.includes(id));
    const saved = await page.evaluate((key) => localStorage.getItem(key), filtersKey('yugioh'));
    if (saved !== JSON.stringify(next)) problems.push(`${filterKey}: Campo no conserva el formato y la clave de filtros`);
    await page.keyboard.press('Escape');
    const countLabel = next.length === 1 ? '1 serie activa' : `${next.length} series activas`;
    if (!(await page.locator('[data-field-control="field"]').innerText()).includes(countLabel)) problems.push(`${filterKey}: contador de series desactualizado`);
    await page.locator('[data-field-control="graveyard"]').click();
    const updated = yesterday(eligibleEntities(entities, next), { franchise: 'yugioh', mode: 'duelista', filterKey: buildFilterKey(next, canonical), day: getDay(new Date(await page.evaluate(() => Date.now()))) });
    if (await page.locator('[data-graveyard-answer]').getAttribute('data-graveyard-answer') !== updated.id) problems.push(`${filterKey}: Cementerio no usa los filtros recién cambiados`);
    await context.close();
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

/** Las cuatro franquicias durante 5 s: nada anima propiedades de layout y el fondo no tiene más de 3 capas animadas. */
async function animationProperties(ctx: Ctx): Promise<string[]> {
  const problems = new Set<string>();
  for (const route of ['/pokemon', '/dragon-ball', '/naruto', '/yugioh']) {
    const context = await newContext(ctx);
    // El fondo ya existe en Yu-Gi-Oh y no depende de la implementación de sus tarjetas.
    const ready = route === '/yugioh' ? '[data-backdrop="yugioh"]' : '[data-card]';
    const page = await open(ctx, context, route, ready);
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
function infoTips(franchise: string, candidates: readonly string[], mode = 'clasico') {
  return (ctx: Ctx) => infoTipsOf(ctx, franchise, candidates, mode);
}

async function infoTipsOf(ctx: Ctx, franchise: string, candidates: readonly string[], mode = 'clasico'): Promise<string[]> {
  const problems: string[] = [];
  const route = `/${franchise}/${mode}`;
  const storage = savedGame(franchise, mode, mode === 'clasico' ? misses(franchise, candidates) : candidates.slice(0, 2));
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
    // Duelista todavía no declara ayudas de columna (fase 5); sí debe tener las ayudas comunes.
    const minimumTips = mode === 'duelista' ? 3 : 10;
    if (count < minimumTips) problems.push(`${size}: solo ${count} ayudas ⓘ (mínimo ${minimumTips})`);
    for (let index = 0; index < count; index++) {
      const button = buttons.nth(index);
      const label = await button.getAttribute('aria-label');
      // Con el foco del teclado.
      await page.keyboard.press('Shift');
      await button.focus();
      await page.waitForSelector('[role="tooltip"][data-placed="true"]');
      let box = await tipBox(page);
      if (!box) problems.push(`${size} ${label}: no abre con el foco`);
      else if (!box.inside) problems.push(`${size} ${label}: ayuda con foco fuera de la ventana`);
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
  for (const route of ['/pokemon/clasico', '/yugioh/duelista']) {
    const isDuelist = route === '/yugioh/duelista';
    const storage = isDuelist ? savedGame('yugioh', 'duelista', ['yugi-muto', 'seto-kaiba']) : {};
    const context = await newContext(ctx, {}, storage);
    const page = await open(ctx, context, route);
    const normalize = (value: string) => value.replace(/["']/g, '').replace(/\s*,\s*/g, ',').trim();
    const body = normalize(await page.evaluate(() => getComputedStyle(document.querySelector('[data-theme-root]')!).getPropertyValue('--font-body')));
    await page.getByRole('button', { name: 'Cómo se juega' }).click();
    await page.waitForSelector('dialog[open]');
    const dialogFont = normalize(await page.evaluate(() => getComputedStyle(document.querySelector('dialog[open] p, dialog[open] li')!).fontFamily));
    if (dialogFont !== body) problems.push(`el modal usa "${dialogFont}" y no "${body}"`);
    await page.keyboard.press('Escape');
    // Duelista solo monta la tabla y sus ayudas cuando hay intentos guardados.
    if (isDuelist) await page.waitForSelector('tbody tr');
    await page.keyboard.press('Shift');
    await page.locator('button[aria-label^="Ayuda"]').first().focus();
    await page.waitForSelector('[role="tooltip"]');
    const tipFont = normalize(await page.evaluate(() => getComputedStyle(document.querySelector('[role="tooltip"]')!).fontFamily));
    if (tipFont !== body) problems.push(`la ayuda usa "${tipFont}" y no "${body}"`);
    await context.close();
  }
  return problems;
}

/** Contrato de la piel egipcia y capturas para el FRENÁ 3, sin decidir la aprobación visual. */
async function yugiohWindows(ctx: Ctx): Promise<string[]> {
  const problems: string[] = [];
  const entities = JSON.parse(readFileSync(path.join(ROOT, 'data/yugioh/entities.json'), 'utf8')) as Array<{ id: string; series: string[] }>;
  const pool = eligibleEntities(entities, ['dm', 'gx', '5ds']);
  const answer = pickDaily(pool, { franchise: 'yugioh', mode: 'duelista', filterKey: 'all', day: today() });
  const miss = pool.find((entity) => entity.id !== answer.id);
  if (!miss) throw new Error('No hay un intento fallido para capturar la partida en curso');
  for (const viewport of [{ width: 360, height: 640 }, { width: 844, height: 390 }, { width: 1920, height: 1080 }, { width: 3840, height: 2160 }]) {
    const context = await newContext(ctx, { viewport, reducedMotion: 'reduce' }, savedGame('yugioh', 'duelista', [miss.id]));
    for (const route of ['/yugioh', '/yugioh/duelista']) {
      const page = await open(ctx, context, route, route === '/yugioh' ? '[data-field-controls]' : GAME_READY);
      await page.evaluate(() => document.fonts.ready);
      const surface = route.endsWith('duelista') ? 'duelista' : 'inicio';
      await shot(page, `yugioh-fase3-${surface}-${viewport.width}x${viewport.height}`);
      if (surface === 'duelista') {
        await page.waitForSelector('tbody [data-match]');
        const cells = await page.locator('tbody [data-match]').evaluateAll((items) => items.map((item) => ({
          match: item.getAttribute('data-match'), color: getComputedStyle(item).backgroundColor,
          marks: Array.from(item.querySelectorAll('[aria-hidden="true"]')).map((mark) => mark.textContent ?? '').join(''),
        })));
        const colors: Record<string, string> = { exact: 'rgb(82, 194, 122)', partial: 'rgb(240, 168, 58)', none: 'rgb(255, 112, 104)' };
        if (!cells.length || cells.some((cell) => /[✓✕≈]/.test(cell.marks) || cell.color !== colors[cell.match ?? ''])) problems.push(`${viewport.width}: celdas con marcas prohibidas o colores incorrectos`);
        const ghosts = await page.locator('button[data-variant="ghost"]').evaluateAll((buttons) => buttons.map((button) => {
          const style = getComputedStyle(button);
          const cursor = button.querySelector('svg:first-child');
          return {
            centered: style.justifyContent === 'center' && Math.abs(parseFloat(style.paddingInlineStart) - parseFloat(style.paddingInlineEnd)) < 1,
            singleFrame: getComputedStyle(button, '::after').boxShadow === 'none' && style.getPropertyValue('--_frame').trim() === '1px',
            noCursorSpace: !cursor || getComputedStyle(cursor).display === 'none',
          };
        }));
        if (ghosts.length < 2 || ghosts.some((ghost) => !ghost.centered || !ghost.singleFrame || !ghost.noCursorSpace)) problems.push(`${viewport.width}: ghost sin centrado o con doble marco/espacio reservado`);
        await page.getByRole('button', { name: 'Estadísticas', exact: true }).click();
      } else await page.locator('[data-field-control="graveyard"]').click();
      await page.waitForSelector('dialog[open]');
      await shot(page, `yugioh-fase3-${surface}-modal-${viewport.width}x${viewport.height}`);
      await page.close();
    }
    await context.close();
  }
  for (const viewport of [{ width: 320, height: 640 }, { width: 360, height: 640 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    const context = await newContext(ctx, { viewport, reducedMotion: 'reduce' });
    const page = await open(ctx, context, '/yugioh', '[data-duel-footer]');
    const geometry = await page.locator('[data-duel-footer]').evaluate((footer) => {
      const closeButton = footer.querySelector('button')!;
      const close = closeButton.getBoundingClientRect();
      const closeStyle = getComputedStyle(closeButton);
      const bevel = getComputedStyle(closeButton, '::after');
      const notice = footer.querySelector('[data-footer-notice]')!.getBoundingClientRect();
      const credits = footer.querySelector('a')!.getBoundingClientRect();
      const overlaps = (a: DOMRect, b: DOMRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      return { touch: close.width >= 44 && close.height >= 44 && credits.width >= 44 && credits.height >= 44,
        carved: bevel.clipPath !== 'none' && bevel.boxShadow !== 'none' && bevel.backgroundColor === 'rgb(241, 207, 120)' && closeStyle.color === 'rgb(23, 19, 15)',
        overlap: overlaps(close, notice) || overlaps(close, credits), overflow: document.documentElement.scrollWidth > window.innerWidth };
    });
    if (!geometry.touch || !geometry.carved || geometry.overlap || geometry.overflow) problems.push(`${viewport.width}: pie ${JSON.stringify(geometry)}`);
    await shot(page, `yugioh-pie-${viewport.width}x${viewport.height}`);
    await page.locator('[data-duel-footer] button').click();
    if (await page.locator('[data-duel-footer]').count()) problems.push(`${viewport.width}: no cierra el aviso`);
    await page.reload();
    if (await page.locator('[data-duel-footer]').count()) problems.push(`${viewport.width}: no persiste el cierre`);
    await context.close();
  }
  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    const context = await newContext(ctx, { viewport: { width: 360, height: 640 }, reducedMotion });
    const page = await open(ctx, context, '/yugioh', '[data-field-control="field"]');
    await page.locator('[data-field-control="field"]').click();
    await page.waitForSelector('[data-chip-card]');
    const chips = page.locator('dialog button[aria-pressed]');
    if (await page.locator('dialog [data-chip-card="face"]').count() !== await chips.count()) problems.push('las series activas no muestran carta boca arriba');
    const chip = chips.filter({ hasText: 'GX' });
    await chip.click();
    if (await chip.getAttribute('aria-pressed') !== 'false' || await chip.locator('[data-chip-card="muted"] [data-frame="fusion"]').count() !== 1) problems.push('GX no conserva su mini-carta de Fusión al apagarla');
    const minis = await page.locator('dialog [data-chip-card]').evaluateAll((items) => items.map((item) => {
      const box = item.getBoundingClientRect();
      const glyph = item.querySelector('[data-chip-glyph]');
      const window = glyph?.parentElement?.getBoundingClientRect();
      const glyphBox = glyph?.getBoundingClientRect();
      return { series: item.getAttribute('data-series'), frame: item.querySelector('[data-frame]')?.getAttribute('data-frame'), width: box.width, height: box.height,
        glyph: glyph?.getAttribute('data-chip-glyph'), mask: glyph ? getComputedStyle(glyph).maskImage : '',
        centered: !!window && !!glyphBox && Math.abs(glyphBox.left + glyphBox.width / 2 - window.left - window.width / 2) < 1 && Math.abs(glyphBox.top + glyphBox.height / 2 - window.top - window.height / 2) < 1,
        glyphRatio: window && glyphBox ? glyphBox.width / window.width : 0,
        warmWindow: glyph ? getComputedStyle(glyph.parentElement!).backgroundImage.includes('radial-gradient') : false };
    }));
    const frames: Record<string, string> = { dm: 'effect', gx: 'fusion', '5ds': 'synchro' };
    const miniRem = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    const glyphs: Record<string, string> = { dm: '01', gx: '14', '5ds': '08' };
    if (await page.locator('dialog [data-chip-card] svg, dialog [data-chip-card] img').count() || minis.some((mini) => Math.abs(mini.width - 1.75 * miniRem) > 1)) problems.push('mini-cartas con arte inline o tamaño distinto de 1,75rem');
    if (minis.some((mini) => mini.glyph !== glyphs[mini.series ?? ''] || !mini.mask.includes('/theme/yugioh/glifos/glifo-' + mini.glyph + '.svg') || !mini.centered || mini.glyphRatio < 0.6 || mini.glyphRatio > 0.65 || !mini.warmWindow)) problems.push('mini-cartas sin el glifo real, centrado o fondo cálido correspondiente');
    if (minis.some((mini) => mini.frame !== frames[mini.series ?? ''] || Math.abs(mini.width - minis[0].width) > 1 || Math.abs(mini.height - minis[0].height) > 1 || Math.abs(mini.height - mini.width * 86 / 59) > 1)) problems.push('mini-cartas con tipo, proporción o tamaño incorrectos');
    if (await page.locator('dialog [data-chip-card="face"]').count() !== await page.locator('dialog button[aria-pressed="true"]').count()) problems.push('el conteo de cartas activas no coincide');
    await page.keyboard.press('Escape');
    for (const control of ['field', 'graveyard']) {
      await page.locator(`[data-field-control="${control}"]`).click();
      await inspectDialog(control);
    }
    await page.goto(`${ctx.baseUrl}/yugioh/duelista`);
    await page.waitForSelector(GAME_READY);
    for (const name of ['Cómo se juega', 'Ajustes', 'Estadísticas']) {
      await page.getByRole('button', { name, exact: true }).click();
      await inspectDialog(name);
    }
    await context.close();

    async function inspectDialog(name: string) {
      const dialog = page.locator('dialog[open]');
      await dialog.waitFor();
      const result = await dialog.evaluate((element) => {
        const panel = element.querySelector('[data-variant="dialog"]')!;
        const style = getComputedStyle(panel);
        const names = style.animationName.split(',').map((value) => value.trim());
        const durations = style.animationDuration.split(',').map((value) => parseFloat(value) * (value.trim().endsWith('ms') ? 1 : 1000));
        const properties: string[] = [];
        for (const animation of panel.getAnimations()) {
          for (const frame of (animation.effect as KeyframeEffect).getKeyframes()) {
            properties.push(...Object.keys(frame).filter((key) => !['offset', 'computedOffset', 'easing', 'composite'].includes(key)));
          }
        }
        const rect = element.getBoundingClientRect();
        return { names, durations, properties, full: Math.abs(rect.width - window.innerWidth) < 1 && Math.abs(rect.height - window.innerHeight) < 1 };
      });
      if (!result.full) problems.push(`${name}: modal móvil no ocupa pantalla completa`);
      if (reducedMotion === 'reduce' ? result.names.some((value) => value !== 'none') : !result.names.some((value) => value.includes('tablet-open'))) problems.push(`${name}: animación incorrecta (${reducedMotion})`);
      if (result.durations.some((value) => value > 400) || result.properties.some((value) => !['transform', 'opacity'].includes(value))) problems.push(`${name}: duración o propiedades inválidas`);
      await page.waitForTimeout(400);
      if (name === 'Cómo se juega') {
        const text = await dialog.innerText();
        if (!text.includes('Verde: el valor coincide con el de la respuesta.') || !text.includes('Naranja: coincide en parte, por ejemplo comparten uno de dos valores.') || !text.includes('Rojo: no coincide.')) problems.push('la ayuda no usa la leyenda genérica');
        const swatches = await dialog.locator('[data-match]').allTextContents();
        if (swatches.length !== 4 || swatches.some((value) => /[✓✕≈]/.test(value)) || swatches[3] !== '↑↓') problems.push('la leyenda no conserva únicamente las flechas');
      }
      const buttons = dialog.locator('button:not([disabled])');
      await buttons.last().focus();
      await page.keyboard.press('Tab');
      if (!await dialog.evaluate((element) => element.contains(document.activeElement))) problems.push(`${name}: Tab sale del modal`);
      await buttons.first().focus();
      await page.keyboard.press('Shift+Tab');
      if (!await dialog.evaluate((element) => element.contains(document.activeElement))) problems.push(`${name}: Shift+Tab sale del modal`);
      await shot(page, `yugioh-modal-${name.replaceAll(' ', '-')}-${reducedMotion}`);
      await page.keyboard.press('Escape');
      await page.waitForSelector('dialog[open]', { state: 'detached' });
    }
  }
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
    { width: 360, height: 640 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 768, height: 1024 },
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
    { width: 2560, height: 1440 },
    { width: 3840, height: 2160 },
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
      ['/yugioh', true],
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
      const small = await page.$$eval('nav[aria-label="Volver"] a', (links) => links.some((link) => {
        const rect = link.getBoundingClientRect();
        return rect.width < 44 || rect.height < 44;
      }));
      if (small) problems.push(`${viewport.width}: ${route} tiene un botón de volver menor a 44 × 44 px`);
      await page.close();
    }
    await context.close();
  }
  // La salida del tema (la Poké Ball que se recoge, la nube que se aleja) demora la navegación 300 ms como mucho.
  for (const [route, home] of [
    ['/pokemon/clasico', /\/pokemon$/],
    ['/dragon-ball/clasico', /\/dragon-ball$/],
    ['/naruto/clasico', /\/naruto$/],
    ['/yugioh/duelista', /\/yugioh$/],
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

/** Entrada de Yu-Gi-Oh: giro de carta <400 ms, solo transform/opacity; ausente con movimiento reducido. */
async function yugiohEntrance(ctx: Ctx): Promise<string[]> {
  const problems: string[] = [];
  for (const viewport of [{ width: 360, height: 640 }, { width: 844, height: 390 }, { width: 1920, height: 1080 }, { width: 3840, height: 2160 }]) {
    for (const reducedMotion of ['no-preference', 'reduce'] as const) {
      const context = await newContext(ctx, { viewport, reducedMotion });
      for (const route of ['/yugioh', '/yugioh/duelista']) {
        const page = await open(ctx, context, route, 'nav[aria-label="Volver"]');
        const result = await page.locator('[data-page-transition="yugioh"]').evaluate((element) => {
          const animations = element.getAnimations({ subtree: true });
          const details = animations.map((animation) => {
            const effect = animation.effect as KeyframeEffect;
            return { end: Number(effect.getComputedTiming().endTime), frames: effect.getKeyframes().map((frame) => ({ ...frame })) };
          });
          // Se busca el instante de sostener la carta, sin depender del tiempo que tarde page.goto.
          for (const animation of animations) { animation.pause(); animation.currentTime = 300; }
          const card = element.querySelector('[data-transition-card]')!;
          const image = card.querySelector('img')!;
          const rect = card.getBoundingClientRect();
          const during = { height: rect.height, width: rect.width, visible: Number(getComputedStyle(card).opacity) > 0.9 && Number(getComputedStyle(element).opacity) > 0.9,
            centered: Math.abs(rect.x + rect.width / 2 - innerWidth / 2) < 2 && Math.abs(rect.y + rect.height / 2 - innerHeight / 2) < 2,
            correctAsset: image.getAttribute('src') === '/theme/yugioh/card-back.webp' };
          for (const animation of animations) animation.currentTime = 800;
          return { display: getComputedStyle(element).display, pointerEvents: getComputedStyle(element).pointerEvents,
            animations: details, during, hiddenAfter: Number(getComputedStyle(element).opacity) === 0 && Number(getComputedStyle(card).opacity) === 0,
            backdropAnimations: document.querySelector('[data-backdrop="yugioh"]')?.getAnimations({ subtree: true }).length ?? 0 };
        });
        if (result.backdropAnimations) problems.push(route + ': el fondo debe ser estatico');
        if (reducedMotion === 'reduce') {
          if (result.display !== 'none' || result.animations.length) problems.push(route + ': entrada animada con movimiento reducido');
        } else {
          if (result.display === 'none' || result.animations.length === 0) problems.push(route + ': falta la entrada de carta');
          if (result.pointerEvents !== 'none') problems.push(route + ': la entrada intercepta eventos');
          for (const animation of result.animations) {
            if (!(animation.end > 0 && animation.end <= 800)) problems.push(route + ': entrada mayor a 800 ms');
            const allowed = new Set(['offset', 'computedOffset', 'easing', 'composite', 'transform', 'opacity']);
            for (const frame of animation.frames) for (const property of Object.keys(frame)) if (!allowed.has(property)) problems.push(route + ': la entrada anima ' + property);
          }
          if (!result.animations.some((animation) => animation.frames.some((frame) => /rotateY/.test(String(frame.transform))))) problems.push(route + ': falta el giro de carta');
          if (!result.during.visible || !result.during.centered || !result.during.correctAsset || result.during.height < viewport.height * 0.4) problems.push(route + ': reverso pequeno, descentrado o invisible durante la entrada');
          if (!result.hiddenAfter) problems.push(route + ': la entrada sigue cubriendo la pagina tras 800 ms');
        }
        await page.close();
      }
      await context.close();
    }
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

/** Fase 5: contratos visuales nuevos, además de los chequeos de flip y ayudas existentes. */
async function yugiohGames(ctx: Ctx): Promise<string[]> {
  const problems: string[] = [];
  for (const mode of ['duelista', 'carta']) {
    const context = await newContext(ctx);
    try {
      const page = await open(ctx, context, `/yugioh/${mode}`);
      await page.waitForSelector('[data-duel-lp="8000"]');
      const expectedColumns = mode === 'duelista' ? 6 : 8;
      const entities = JSON.parse(readFileSync(path.join(ROOT, 'data/yugioh', mode === 'carta' ? 'cards.json' : 'entities.json'), 'utf8')) as Array<{ id: string; name: { es: string }; series: string[] }>;
      const pool = entities.filter((entity) => entity.series.some((series) => ['dm', 'gx', '5ds'].includes(series)));
      const answer = pickDaily(pool, { franchise: 'yugioh', mode, filterKey: 'all', day: today() });
      const miss = pool.find((entity) => entity.id !== answer.id)!;
      await guess(page, miss.name.es);
      const back = page.locator('[data-duel-cell-back] img');
      await back.first().waitFor({ state: 'attached', timeout: 2_000 });
      if (await page.locator('thead th button').count() !== expectedColumns) problems.push(`${mode}: faltan ayudas en las columnas`);
      if (!(await back.evaluateAll((images) => images.every((image) => image.getAttribute('src') === '/theme/yugioh/card-back.webp')))) problems.push(`${mode}: dorso de celda distinto del reverso real`);
      await page.waitForSelector('[data-duel-lp="7200"]');
      if (await page.locator('[data-duel-table] [data-mode="flip"]').count() !== expectedColumns) problems.push(`${mode}: las celdas no usan flip`);
      await page.waitForSelector('[data-duel-table] [data-reveal="revealing"]', { state: 'detached' });
      if (mode === 'carta' && await page.locator('[data-duel-class]').count() !== 1) problems.push('Carta: falta banda de marco en Clase');
      if (await page.locator('[data-duel-table] [data-part="value"]').count() !== expectedColumns) problems.push(`${mode}: los valores dejaron de estar escritos`);
      await guess(page, answer.name.es);
      await page.waitForSelector('[data-duel-victory]');
      if (!(await page.locator('[data-duel-victory]').innerText()).includes('¡Duelo ganado!')) problems.push(`${mode}: falta victoria del duelo`);
      await page.waitForFunction(() => document.querySelector('[data-duel-victory] [aria-hidden="true"]')?.textContent === '0');
      if (await page.locator('[data-duel-lp="7200"]').count() !== 1) problems.push(`${mode}: acertar descontó LP del jugador`);
    } finally {
      await context.close();
    }
  }
  // Fase 5b: los montajes adicionales se habilitan solo para esta piel.
  for (const [mode, engine] of [
    ['silueta', 'image-reveal'], ['arte', 'image-reveal'], ['zoom', 'image-reveal'], ['carta-insignia', 'image-reveal'],
    ['texto', 'text-clue'], ['deck', 'reveal-list'], ['invocacion', 'reveal-list'], ['mayor-o-menor', 'higher-lower'],
  ] as const) {
    const context = await newContext(ctx);
    try {
      const page = await open(ctx, context, `/yugioh/${mode}`);
      await page.waitForSelector('[data-duel-lp="8000"]');
      if (await page.locator('[data-duel-lp]').count() !== 1) problems.push(`${mode}: medidor ausente o duplicado`);
      if (engine === 'reveal-list') {
        const positions = await page.locator('li[data-revealed] [data-anime-chain-position]').allTextContents();
        if (positions.length === 0 || positions.some((text, index) => text.trim() !== `Cadena ${index + 1}`)) problems.push(`${mode}: faltan los prefijos Cadena N o cambió el orden`);
      }
    } finally { await context.close(); }
  }
  return problems;
}


/** La home es un televisor de tubo: pantalla enlazada, control remoto con los cuatro canales, estática y reduced-motion. */
async function hubTelevision(ctx: Ctx): Promise<string[]> {
  const problems: string[] = [];
  const NAME = /^.+: \d+ de \d+ retos? de hoy$/;
  for (const viewport of [
    { width: 360, height: 640 }, { width: 390, height: 844 }, { width: 844, height: 390 },
    { width: 768, height: 1024 }, { width: 1366, height: 768 }, { width: 1920, height: 1080 },
    { width: 2560, height: 1440 }, { width: 3840, height: 2160 },
  ]) {
    const context = await newContext(ctx, { viewport });
    try {
      const page = await open(ctx, context, '/', '[data-hub="tv"]');
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => document.querySelector('[data-tv-screen][data-progress-ready="true"]') !== null);
      const state = await page.evaluate(() => {
        const keys = [...document.querySelectorAll<HTMLAnchorElement>('[data-remote-key]')];
        const screen = document.querySelector<HTMLAnchorElement>('[data-tv-screen]');
        const badge = document.querySelector('h1');
        const tuners = [...document.querySelectorAll<HTMLButtonElement>('button[aria-label^="Canal"]')];
        const frame = document.querySelector('[data-tv-room] > section')!.getBoundingClientRect();
        return {
          keys: keys.map((key) => ({ href: key.getAttribute('href'), name: key.getAttribute('aria-label') ?? '', small: key.getBoundingClientRect().height < 43 })),
          screen: { href: screen?.getAttribute('href'), name: screen?.getAttribute('aria-label') ?? '' },
          h1: document.querySelectorAll('h1').length === 1 && /AnimeGuess/i.test(badge?.textContent ?? ''),
          tuners: tuners.map((button) => ({ name: button.getAttribute('aria-label'), small: button.getBoundingClientRect().height < 43 })),
          live: document.querySelectorAll('[role="status"][aria-live="polite"]').length,
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          frameInside: frame.left >= -1 && frame.right <= innerWidth + 1,
        };
      });
      if (state.keys.length !== 4 || state.keys.map((key) => key.href).join('|') !== '/pokemon|/dragon-ball|/naruto|/yugioh') problems.push(`Televisor ${viewport.width}: el control no tiene los cuatro enlaces en orden`);
      if (state.keys.some((key) => !NAME.test(key.name)) || !NAME.test(state.screen.name)) problems.push(`Televisor ${viewport.width}: nombre accesible sin franquicia o conteo`);
      if (state.keys.some((key) => key.small) || state.tuners.some((button) => button.small)) problems.push(`Televisor ${viewport.width}: botones menores a 44 px`);
      if (state.screen.href !== '/pokemon') problems.push(`Televisor ${viewport.width}: la pantalla no enlaza al canal 1`);
      if (!state.h1) problems.push(`Televisor ${viewport.width}: falta el título (chapa) como único h1`);
      if (state.tuners.length !== 2 || state.tuners.some((button) => !button.name)) problems.push(`Televisor ${viewport.width}: faltan los botones ▲/▼ con nombre`);
      if (state.live !== 1) problems.push(`Televisor ${viewport.width}: falta la región aria-live`);
      if (state.overflow || !state.frameInside) problems.push(`Televisor ${viewport.width}: desborde horizontal`);
      // El control remoto queda a la vista sin desplazarse en pantallas de escritorio.
      if (viewport.width >= 1366) {
        const inside = await page.locator('[data-remote-key]').last().evaluate((key) => key.getBoundingClientRect().bottom <= innerHeight);
        if (!inside) problems.push(`Televisor ${viewport.width}: el control remoto no entra en la primera pantalla`);
      }
      await shot(page, `hub-televisor-${viewport.width}`);
    } finally { await context.close(); }
  }

  // Cambio de canal: ▲, flechas y hover, con la estática solo en transform y opacity y el anuncio en aria-live.
  const context = await newContext(ctx, { viewport: { width: 1366, height: 768 } });
  try {
    const page = await open(ctx, context, '/', '[data-hub="tv"]');
    await page.waitForFunction(() => document.querySelector('[data-tv-screen][data-progress-ready="true"]') !== null);
    const channel = () => page.locator('[data-tv-room]').getAttribute('data-channel');
    // La estática ya tapa toda la pantalla en el instante en que el canal cambia (no se ve la imagen nueva a través de ella).
    const covered = page.evaluate(() => new Promise<number>((resolve) => {
      const room = document.querySelector('[data-tv-room]')!;
      const noise = () => document.querySelector<HTMLElement>('[data-tv-noise]')!;
      new MutationObserver((_records, observer) => { observer.disconnect(); resolve(Number.parseFloat(getComputedStyle(noise()).opacity)); }).observe(room, { attributes: true, attributeFilter: ['data-channel'] });
      setTimeout(() => resolve(-1), 3000);
    }));
    await page.getByRole('button', { name: 'Canal siguiente' }).click();
    await page.waitForTimeout(60);
    const kinds = await page.evaluate(() => {
      const names = new Set<string>();
      for (const animation of document.getAnimations()) {
        const target = (animation.effect as KeyframeEffect | null)?.target as HTMLElement | null;
        if (!target?.closest('[data-tv-noise]')) continue;
        for (const frame of (animation.effect as KeyframeEffect).getKeyframes()) for (const name of Object.keys(frame)) names.add(name);
      }
      return [...names];
    });
    if (kinds.length === 0 || kinds.some((name) => !['opacity', 'transform', 'offset', 'easing', 'composite', 'computedOffset'].includes(name))) problems.push(`Televisor: la estática anima ${kinds.join(', ') || 'nada'} y solo puede transform y opacity`);
    const during = await covered;
    if (during < 0.99) problems.push(`Televisor: la estática no tapa la pantalla por completo cuando cambia el canal (opacidad ${during})`);
    await page.waitForTimeout(900);
    if ((await channel()) !== '2') problems.push('Televisor: ▲ no cambia al canal 2');
    await page.getByRole('button', { name: 'Canal anterior' }).click();
    await page.waitForTimeout(900);
    if ((await channel()) !== '1') problems.push('Televisor: ▼ no vuelve al canal 1');
    // Pasar rápido por varios canales termina en el último pedido.
    const keys = page.locator('[data-remote-key]');
    for (const index of [2, 3, 0, 1, 2]) { await keys.nth(index).hover(); await page.waitForTimeout(40); }
    await page.waitForTimeout(1800);
    if ((await channel()) !== '3') problems.push(`Televisor: al pasar rápido por los canales quedó en ${await channel()} y no en 3`);
    await keys.nth(1).focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(1800);
    if ((await channel()) !== '3' && (await channel()) !== '4') problems.push('Televisor: las flechas no cambian de canal');
    if (!/^Canal \d: /.test((await page.locator('[role="status"][aria-live="polite"]').textContent()) ?? '')) problems.push('Televisor: el cambio de canal no se anuncia');
  } finally { await context.close(); }

  // Reduced-motion: cambio instantáneo, sin estática ni parpadeo.
  const reduced = await newContext(ctx, { reducedMotion: 'reduce', viewport: { width: 1366, height: 768 } });
  try {
    const page = await open(ctx, reduced, '/', '[data-hub="tv"]');
    await page.waitForFunction(() => document.querySelector('[data-tv-screen][data-progress-ready="true"]') !== null);
    await page.getByRole('button', { name: 'Canal siguiente' }).click();
    await page.waitForTimeout(60);
    if ((await page.locator('[data-tv-room]').getAttribute('data-channel')) !== '2') problems.push('Televisor: con reduced-motion el canal no cambia al instante');
    const moving = await page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === 'running').length);
    if (moving > 0) problems.push(`Televisor: con reduced-motion hay ${moving} animaciones corriendo`);
    await page.keyboard.press('Shift');
    await page.locator('[data-tv-screen]').focus();
    const outline = await page.locator('[data-tv-screen]').evaluate((el) => getComputedStyle(el).outlineStyle !== 'none');
    if (!outline) problems.push('Televisor: la pantalla enlazada no muestra foco');
  } finally { await reduced.close(); }

  // Entrar: la estática cubre la ventana (también el pie) con solo transform y opacidad, y navega.
  const enter = await newContext(ctx, { viewport: { width: 1366, height: 1100 } });
  try {
    const page = await open(ctx, enter, '/', '[data-hub="tv"]');
    await page.waitForFunction(() => document.querySelector('[data-tv-screen][data-progress-ready="true"]') !== null);
    await page.locator('[data-tv-screen]').click();
    await page.waitForTimeout(350);
    const info = await page.evaluate(() => {
      const layer = document.querySelector<HTMLElement>('[data-tv-full-static]');
      const footer = document.querySelector('footer');
      return {
        covers: layer !== null && layer.parentElement === document.body && getComputedStyle(layer).position === 'fixed',
        opacity: layer ? Number.parseFloat(getComputedStyle(layer).opacity) : 0,
        footerHidden: footer === null || getComputedStyle(footer).visibility === 'hidden',
      };
    });
    if (!info.covers || info.opacity < 0.99) problems.push('Televisor: al entrar la estática no cubre toda la ventana');
    if (!info.footerHidden) problems.push('Televisor: el pie se ve durante la transición');
    await page.waitForURL('**/pokemon', { timeout: 8000 });
  } finally { await enter.close(); }
  return problems;
}

async function yugiohDuelCards(ctx: Ctx): Promise<string[]> {
  const problems: string[] = [];
  for (const viewport of [
    { width: 360, height: 640 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 768, height: 1024 },
    { width: 1366, height: 768 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }, { width: 3840, height: 2160 },
  ]) {
    const context = await newContext(ctx, { viewport });
    try {
      const page = await open(ctx, context, '/yugioh/mayor-o-menor', '[data-option]');
      const cards = page.locator('[data-option]');
      const before = await cards.evaluateAll((items) => items.map((item) => {
        const card = item as HTMLElement;
        const image = card.querySelector('img')!;
        return { width: card.offsetWidth, height: card.offsetHeight, top: card.offsetTop,
          image: image.getBoundingClientRect().height, reading: getComputedStyle(card.querySelector('[data-part="reading"]')!).display };
      }));
      if (before.length !== 2 || before.some((card) => card.reading !== 'contents')) problems.push(`${viewport.width}: las opciones no integran nombre y lectura en la carta`);
      if (viewport.width === 1920 && before.some((card) => card.image <= 144)) problems.push('Mayor o Menor: la ilustración de escritorio sigue demasiado pequeña');
      const duelHeight = await page.locator('[data-part="duel"]').evaluate((duel) => (duel as HTMLElement).offsetHeight);
      // Elegir deliberadamente la mayor garantiza que aparezca Siguiente.
      const cardData = JSON.parse(readFileSync(path.join(ROOT, 'data/yugioh/cards.json'), 'utf8')) as Array<{ name: { es: string }; attrs: Record<string, unknown> }>;
      const question = await page.locator('[data-part="duel"]').evaluate((duel) => document.getElementById(duel.getAttribute('aria-labelledby')!)?.textContent ?? '');
      const metric = question.includes('ATK') ? 'atk' : question.includes('DEF') ? 'def' : 'nivel';
      const values = await cards.locator('[data-part="reading"] > span:first-child').allTextContents();
      const numbers = values.map((name) => Number(cardData.find((card) => card.name.es === name)?.attrs[metric]));
      if (numbers.some((value) => !Number.isFinite(value))) throw new Error('No se pudo identificar la métrica de las cartas del duelo');
      await cards.nth(numbers[0] > numbers[1] ? 0 : 1).click();
      await page.waitForSelector('[data-option][data-revealed="true"]');
      const next = page.locator('[data-part="next"]');
      await next.waitFor();
      const nextState = await next.evaluate((button) => {
        const box = button.getBoundingClientRect();
        const duel = button.closest('[data-part="duel"]')!;
        const [a, b] = [...duel.querySelectorAll<HTMLElement>('[data-option]')];
        const first = a.getBoundingClientRect();
        const second = b.getBoundingClientRect();
        const wide = innerWidth >= 768 || innerWidth > innerHeight;
        // El centro se mide en layout; la ausencia de solapamiento incluye la inclinación visual.
        const center = wide ? (a.offsetLeft + a.offsetWidth + b.offsetLeft) / 2 : (a.offsetTop + a.offsetHeight + b.offsetTop) / 2;
        const ownCenter = wide ? (button as HTMLElement).offsetLeft + box.width / 2 : (button as HTMLElement).offsetTop + box.height / 2;
        return { between: wide ? box.left >= first.right - 1 && box.right <= second.left + 1 : box.top >= first.bottom - 1 && box.bottom <= second.top + 1,
          centered: Math.abs(ownCenter - center) < 2,
          touch: box.width >= 44 && box.height >= 44, focused: document.activeElement === button, height: (duel as HTMLElement).offsetHeight };
      });
      if (!nextState.between || !nextState.centered || !nextState.touch || !nextState.focused) problems.push(`${viewport.width}: Siguiente no queda entre las cartas, las tapa, pierde foco o mide menos de 44 px`);
      const cleanCards = await cards.evaluateAll((items) => items.every((item) => {
        const option = item as HTMLElement;
        const frame = option.querySelector<HTMLElement>('[data-anime-card]')!;
        const name = option.querySelector<HTMLElement>('[data-part="reading"] > span:first-child')!;
        const body = frame.lastElementChild!;
        const readings = [...option.querySelectorAll<HTMLElement>('[data-part="value"], [data-part="meter"], [data-part="badges"]')];
        // El nombre va justo debajo de la carta (sin franja ni hueco entre las dos); las dos opciones comparten alto de fila.
        return Math.abs(name.offsetTop - (frame.offsetTop + frame.offsetHeight)) <= 2
          && Number.parseFloat(getComputedStyle(body).paddingBottom) <= frame.offsetWidth * 0.025 + 2
          && readings.every((reading) => reading.offsetWidth <= 2 && reading.offsetHeight <= 2 && getComputedStyle(reading).clipPath !== 'none');
      }));
      if (!cleanCards) problems.push(`${viewport.width}: persiste una franja inferior o la lectura no está visualmente oculta`);
      if (await page.locator('[data-anime-choice]:visible').count() !== 1) problems.push(`${viewport.width}: la elección no se marca solo sobre la carta elegida`);
      if (Math.abs(nextState.height - duelHeight) > 1) problems.push(`${viewport.width}: apareció Siguiente sin reservar su espacio`);
      const after = await cards.evaluateAll((items) => items.map((item) => {
        const card = item as HTMLElement;
        return { width: card.offsetWidth, height: card.offsetHeight, top: card.offsetTop };
      }));
      if (after.some((card, index) => Math.abs(card.width - before[index].width) > 1 || Math.abs(card.height - before[index].height) > 1 || Math.abs(card.top - before[index].top) > 1)) problems.push(`${viewport.width}: salto de layout al revelar valores y badges del duelo`);
      if (await page.locator('[data-duel-lp="8000"]').count() !== 1) problems.push('Mayor o Menor: acertar gastó LP');
      await next.click();
      await page.waitForSelector('[data-option][data-revealed="false"]');
      const nextNames = await cards.locator('[data-part="reading"] > span:first-child').allTextContents();
      const nextValues = nextNames.map((name) => Number(cardData.find((card) => card.name.es === name)?.attrs[metric]));
      if (nextValues.some((value) => !Number.isFinite(value))) throw new Error('No se identificaron los valores de la segunda ronda');
      await cards.nth(nextValues[0] < nextValues[1] ? 0 : 1).click();
      await page.waitForSelector('[data-duel-lp="0"]');
      await page.waitForSelector('[data-duel-victory]');
      if (!(await page.locator('[data-duel-victory]').innerText()).includes('¡Duelo ganado!')) problems.push('Mayor o Menor: falta el festejo opt-in del resumen por puntaje');
      await page.waitForFunction(() => document.querySelector('[data-duel-victory] [aria-hidden="true"]')?.textContent === '0');
    } finally { await context.close(); }
  }
  return problems;
}

const CHECKS: ReadonlyArray<{ name: string; run: (ctx: Ctx) => Promise<string[]> }> = [
  { name: 'Hub: televisor de tubo, canales, control remoto y estática', run: hubTelevision },
  { name: 'Yu-Gi-Oh: cartas enfrentadas sin salto de lectura', run: yugiohDuelCards },
  { name: 'Yu-Gi-Oh: LP, clase de carta y victoria (fase 5)', run: yugiohGames },
  { name: 'Yu-Gi-Oh: papiro, chips, tablillas y ghost (FRENÁ 3)', run: yugiohWindows },
  { name: 'Ayudas ⓘ de Yu-Gi-Oh', run: infoTips('yugioh', ['yugi-muto', 'seto-kaiba'], 'duelista') },
  { name: '/yugioh: once cartas, enlaces, orden, hidratación y movimiento reducido', run: yugiohField },
  { name: '/yugioh: Cementerio y filtros de Zona de Campo', run: yugiohGraveyard },
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
  { name: 'Yu-Gi-Oh: reverso central, entrada hasta 800 ms y movimiento reducido', run: yugiohEntrance },
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
