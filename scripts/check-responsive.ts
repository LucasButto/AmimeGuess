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

/** Una partida con intentos ya hechos (de Pokémon salvo que se diga otra franquicia), para probar la tabla llena o la imagen a medio revelar. */
function seededGame(filterKey: string, attempts: string[], mode = 'clasico', franchise = 'pokemon'): Record<string, string> {
  const key = stateKey({ franchise, mode, filterKey, day: getDay(new Date()) });
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

/** Estadísticas de Mayor o Menor: un modo de puntaje, con la distribución por aciertos seguidos (incluido el 0). */
function seededScoreStats(): Record<string, string> {
  const today = getDay(new Date());
  return {
    [statsKey('pokemon', 'mayor-o-menor')]: JSON.stringify({
      played: 12,
      won: 12,
      distribution: { '0': 3, '1': 2, '2': 2, '4': 2, '7': 2, '14': 1 },
      currentStreak: 3,
      maxStreak: 5,
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

/**
 * Mayor o Menor: las dos opciones se apilan en un teléfono vertical y van lado a lado en horizontal
 * y desde `md` (768 px). Se comprueba también con una opción ya elegida, que es más alta.
 */
async function optionsLayout(page: Page): Promise<string[]> {
  const info = await page.evaluate(() => {
    const [a, b] = [...document.querySelectorAll('[data-option]')].map((option) => option.getBoundingClientRect());
    return a && b ? { aTop: a.top, bTop: b.top, aBottom: a.bottom, width: window.innerWidth, height: window.innerHeight } : null;
  });
  if (!info) return ['no se encontraron las dos opciones'];
  const wide = info.width >= 768 || info.width > info.height;
  const sameRow = Math.abs(info.aTop - info.bTop) < 2;
  const stacked = info.bTop >= info.aBottom - 1;
  if (wide && !sameRow) return [`las opciones deberían ir lado a lado en ${info.width}×${info.height}`];
  if (!wide && !stacked) return [`las opciones deberían apilarse en ${info.width}×${info.height}`];
  return [];
}

/** Elige una de las dos opciones y espera a que se muestren los valores. */
function afterPicking(index: number): (page: Page) => Promise<string[]> {
  return async (page) => {
    await page.locator('[data-option]').nth(index).click();
    await page.waitForSelector('[data-revealed="true"]');
    return optionsLayout(page);
  };
}


// --- Sesión 09: Dragon Ball --------------------------------------------------------------------

/** Seis personajes de Dragon Ball para probar la tabla llena del Clásico. */
const DB_SIX_ATTEMPTS = ['goku', 'vegeta', 'freezer', 'celula', 'gogeta', 'majin-buu'];

/**
 * Tres personajes sin imagen: en Silueta, Borroso y Zoom no pueden ser la respuesta del día (solo se
 * puede adivinar quien tiene imagen), así que son fallos seguros para sembrar una partida a medias.
 */
const DB_THREE_MISSES = ['oolong', 'puar', 'yajirobe'];

/** Tres formas para sembrar fallos en Transformación (con tres de 39 posibles, casi seguro que no es ninguna). */
const DB_THREE_FORMS = ['goku-ssj', 'vegeta-ssj', 'gohan-ssj'];

/** Todas las series menos GT: la tabla del Clásico oculta lo que es de esa serie. */
const WITHOUT_GT = 'db.dbz.super.daima';

/** El juego de la línea de tiempo está montado (el modo queda oculto mientras no haya sucesos verificados). */
const TIMELINE_GAME = '[data-game-ready][data-over]';

async function hasTimelineGame(page: Page): Promise<boolean> {
  return (await page.locator(TIMELINE_GAME).count()) > 0;
}

/** Los sucesos de la línea de tiempo, de arriba abajo. */
function timelineTexts(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('[data-item] p')].map((text) => (text.textContent ?? '').replace(/^\s*\d+/, '').trim()),
  );
}

/** Con una pantalla de teléfono: todo lo que se toca mide al menos 44 × 44 px, el asa también; nada se sale de la pantalla. */
async function timelineLayout(page: Page, { phone }: { phone: boolean }): Promise<string[]> {
  if (!(await hasTimelineGame(page))) return [];
  const info = await page.evaluate(() => {
    const boxOf = (element: Element) => {
      const box = element.getBoundingClientRect();
      return { width: box.width, height: box.height, left: box.left, right: box.right };
    };
    return {
      items: [...document.querySelectorAll('[data-item]')].map(boxOf),
      handles: [...document.querySelectorAll('[data-handle]')].map(boxOf),
      width: window.innerWidth,
    };
  });
  const problems: string[] = [];
  if (info.items.length < 2) problems.push('no se encontraron los sucesos');
  if (info.items.some((box) => box.left < -0.5 || box.right > info.width + 0.5)) problems.push('un suceso se sale de la pantalla en horizontal');
  if (phone && info.handles.some((box) => box.width < TOUCH_TARGET_PX - 0.5 || box.height < TOUCH_TARGET_PX - 0.5)) {
    problems.push('el asa de arrastre mide menos de 44 × 44 px');
  }
  return problems;
}

/**
 * Arrastra el primer suceso hasta el tercer lugar, con el dedo (eventos táctiles reales) o con el mouse, y comprueba el orden.
 * Hasta el tercero y no solo hasta el segundo: al reordenar durante el arrastre el navegador podía correr la página bajo el
 * dedo (scroll anchoring) y el suceso se quedaba en el segundo lugar.
 */
async function timelineDrag(page: Page, { phone }: { phone: boolean }): Promise<string[]> {
  if (!(await hasTimelineGame(page))) return [];
  // La lista queda debajo de la navegación y los filtros: se lleva a la vista, como haría una persona antes de arrastrar.
  await page.evaluate(() => document.querySelector('[data-item]')?.scrollIntoView({ block: 'start' }));
  const before = await timelineTexts(page);
  const boxes = await page.evaluate(() => {
    const items = [...document.querySelectorAll('[data-item]')].map((item) => item.getBoundingClientRect());
    const handle = document.querySelector('[data-item] [data-handle]')?.getBoundingClientRect();
    return handle && items.length > 2
      ? { handle: { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 }, third: { y: items[2].y, height: items[2].height } }
      : null;
  });
  if (!boxes) return ['no se encontró el asa de arrastre'];
  const scrollBefore = await page.evaluate(() => window.scrollY);
  const from = boxes.handle;
  const to = { x: from.x, y: boxes.third.y + boxes.third.height - 2 };
  const steps = 10;

  if (phone) {
    const client = await page.context().newCDPSession(page);
    const send = (type: 'touchStart' | 'touchMove' | 'touchEnd', y: number) =>
      client.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: from.x, y }] });
    await send('touchStart', from.y);
    for (let step = 1; step <= steps; step++) await send('touchMove', from.y + ((to.y - from.y) * step) / steps);
    await send('touchEnd', to.y);
  } else {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps });
    await page.mouse.up();
  }

  const after = await timelineTexts(page);
  const problems: string[] = [];
  if (after[0] !== before[1] || after[1] !== before[2] || after[2] !== before[0] || after.slice(3).join() !== before.slice(3).join()) {
    problems.push(`arrastrar el primer suceso hasta el tercer lugar no lo dejó tercero (${phone ? 'con el dedo' : 'con el mouse'})`);
  }
  if (phone && (await page.evaluate(() => window.scrollY)) !== scrollBefore) problems.push('la página se desplazó mientras se arrastraba con el dedo');
  return problems;
}

/** Con el teclado: enfocar "Bajar" del primer suceso, activarlo, y que el suceso baje y el foco lo acompañe. */
async function timelineKeyboard(page: Page): Promise<string[]> {
  if (!(await hasTimelineGame(page))) return [];
  const before = await timelineTexts(page);
  const down = page.locator('[data-item]').first().getByRole('button', { name: /^Bajar:/ });
  await down.focus();
  await page.keyboard.press('Enter');
  const after = await timelineTexts(page);
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');
  const problems: string[] = [];
  if (after[1] !== before[0] || after[0] !== before[1]) problems.push('el botón "Bajar" no movió el suceso');
  if (!focused.includes(before[0])) problems.push('el foco no acompañó al suceso que se movió con el botón');
  return problems;
}

/** Mueve un suceso con el teclado, confirma el orden y comprueba que se cuenta un intento. */
async function timelineConfirm(page: Page, { phone }: { phone: boolean }): Promise<string[]> {
  if (!(await hasTimelineGame(page))) return [];
  const problems = await timelineKeyboard(page);
  await page.getByRole('button', { name: 'Confirmar orden' }).click();
  const counter = await page.locator('[data-game-ready] p', { hasText: /^Intento \d de \d$/ }).innerText();
  if (counter !== 'Intento 2 de 4') problems.push(`después de confirmar se esperaba "Intento 2 de 4" y dice "${counter}"`);
  return [...problems, ...(await timelineLayout(page, { phone }))];
}

/** Gasta los 4 intentos (o resuelve por suerte): el juego termina, muestra el orden correcto y el resumen del marco. */
async function timelineFinish(page: Page, { phone }: { phone: boolean }): Promise<string[]> {
  if (!(await hasTimelineGame(page))) return [];
  for (let attempt = 0; attempt < 4; attempt++) {
    if ((await page.locator(TIMELINE_GAME).getAttribute('data-over')) === 'true') break;
    // Un cambio cualquiera para poder confirmar de nuevo: el primer botón de mover que se pueda usar.
    const move = page.locator('[data-item] button:not([disabled])').first();
    if ((await move.count()) > 0) await move.click();
    await page.getByRole('button', { name: 'Confirmar orden' }).click();
  }
  const problems: string[] = [];
  if ((await page.locator(TIMELINE_GAME).getAttribute('data-over')) !== 'true') problems.push('después de 4 intentos el juego no terminó');
  if ((await page.locator('[data-game-ready] [data-handle], [data-game-ready] button[aria-label]').count()) > 0) {
    problems.push('al terminar siguen los controles para mover los sucesos');
  }
  if ((await page.locator('section[data-won]').count()) === 0) problems.push('no aparece el resumen del marco al terminar');
  return [...problems, ...(await timelineLayout(page, { phone }))];
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
  // Sesión 07: Moveset (lista de pistas) y Mayor o Menor (puntaje).
  { name: 'pokemon-moveset', path: '/pokemon/moveset', ready: GAME_READY },
  {
    // Con 3 fallos ya se ven las 4 pistas.
    name: 'pokemon-moveset-3-fallos',
    path: '/pokemon/moveset',
    ready: GAME_READY,
    storage: seededGame('all', neverAnswers('moveset', 3), 'moveset'),
  },
  {
    name: 'pokemon-moveset-victoria',
    path: '/pokemon/moveset?s=g6',
    ready: GAME_READY,
    storage: seededGame('g6', wholeGeneration('g6'), 'moveset'),
  },
  { name: 'pokemon-mayor-o-menor', path: '/pokemon/mayor-o-menor', ready: GAME_READY, check: optionsLayout },
  // Una de las dos opciones es la mayor: elegir una y la otra cubre el acierto y el error, sea cual sea el día.
  { name: 'pokemon-mayor-o-menor-elegida-1', path: '/pokemon/mayor-o-menor', ready: GAME_READY, check: afterPicking(0) },
  { name: 'pokemon-mayor-o-menor-elegida-2', path: '/pokemon/mayor-o-menor', ready: GAME_READY, check: afterPicking(1) },
  {
    name: 'pokemon-mayor-o-menor-estadisticas',
    path: '/pokemon/mayor-o-menor',
    ready: GAME_READY,
    storage: seededScoreStats(),
    before: (page, context) => openDialog(page, 'Estadísticas', context),
  },
  // Sesión 09: los 9 modos de Dragon Ball. Los que dependen de contenido que revisa una persona (frases y
  // sucesos verificados, capturas de técnicas cargadas a mano) quedan ocultos mientras no haya: sus rutas
  // se revisan igual (muestran "Próximamente") y sus comprobaciones propias se saltean si el juego no está.
  { name: 'dragon-ball', path: '/dragon-ball' },
  { name: 'dragon-ball-clasico', path: '/dragon-ball/clasico', ready: GAME_READY },
  {
    // 7 columnas, con la serie y la saga de debut con el nombre de cada una.
    name: 'dragon-ball-clasico-6-intentos',
    path: '/dragon-ball/clasico',
    ready: GAME_READY,
    storage: seededGame('all', DB_SIX_ATTEMPTS, 'clasico', 'dragon-ball'),
  },
  {
    // Sin GT: las transformaciones de GT desaparecen y Gogeta, que debutó en GT, ve su debut oculto ("—").
    name: 'dragon-ball-clasico-sin-gt',
    path: `/dragon-ball/clasico?s=${WITHOUT_GT}`,
    ready: GAME_READY,
    storage: seededGame(WITHOUT_GT, DB_SIX_ATTEMPTS, 'clasico', 'dragon-ball'),
  },
  ...['silueta', 'borroso', 'zoom'].flatMap((slug) => [
    { name: `dragon-ball-${slug}`, path: `/dragon-ball/${slug}`, ready: GAME_READY, check: imageFitsWithField },
    {
      name: `dragon-ball-${slug}-3-fallos`,
      path: `/dragon-ball/${slug}`,
      ready: GAME_READY,
      storage: seededGame('all', DB_THREE_MISSES, slug, 'dragon-ball'),
      check: imageFitsWithField,
    },
  ]),
  { name: 'dragon-ball-transformacion', path: '/dragon-ball/transformacion', ready: GAME_READY, check: imageFitsWithField },
  {
    name: 'dragon-ball-transformacion-3-fallos',
    path: '/dragon-ball/transformacion',
    ready: GAME_READY,
    storage: seededGame('all', DB_THREE_FORMS, 'transformacion', 'dragon-ball'),
    check: imageFitsWithField,
  },
  // Ninguna forma es de Daima: con solo esa serie el modo no alcanza el pool mínimo.
  { name: 'dragon-ball-transformacion-sin-pool', path: '/dragon-ball/transformacion?s=daima', check: showsPoolWarning },
  { name: 'dragon-ball-poder', path: '/dragon-ball/poder', ready: GAME_READY, check: optionsLayout },
  { name: 'dragon-ball-poder-elegida-1', path: '/dragon-ball/poder', ready: GAME_READY, check: afterPicking(0) },
  { name: 'dragon-ball-poder-elegida-2', path: '/dragon-ball/poder', ready: GAME_READY, check: afterPicking(1) },
  { name: 'dragon-ball-frase', path: '/dragon-ball/frase' },
  { name: 'dragon-ball-tecnica', path: '/dragon-ball/tecnica' },
  { name: 'dragon-ball-linea-de-tiempo', path: '/dragon-ball/linea-de-tiempo', check: timelineLayout },
  // Arrastrar: con el dedo en un teléfono y con el mouse en el resto.
  { name: 'dragon-ball-linea-de-tiempo-arrastrar', path: '/dragon-ball/linea-de-tiempo', check: timelineDrag },
  { name: 'dragon-ball-linea-de-tiempo-confirmado', path: '/dragon-ball/linea-de-tiempo', check: timelineConfirm },
  { name: 'dragon-ball-linea-de-tiempo-terminado', path: '/dragon-ball/linea-de-tiempo', check: timelineFinish },
  // Movimiento insignia con solo g3 (6 posibles): no alcanza el mínimo. Descripción ya no tiene una combinación sin pool
  // desde que las de g8 y g9 vienen de WikiDex (con solo g9 hay 120), así que el aviso se prueba con este modo y con Transformación.
  { name: 'pokemon-movimiento-insignia-sin-pool', path: '/pokemon/movimiento-insignia?s=g3', check: showsPoolWarning },
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
