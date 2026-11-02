// Service worker de AnimeGuess: deja jugar sin conexión lo que ya se visitó.
//
// Estrategia (a mano, sin dependencias):
//  - Páginas (navegaciones): primero la red, así nunca se sirve un reto o una versión vieja con conexión. Si la red falla o
//    tarda demasiado, la copia guardada de esa misma página; si nunca se visitó, la página "Sin conexión".
//  - /_next/static/ (archivos con hash en el nombre, nunca cambian): primero la copia, y se guarda al pedirse.
//  - Imágenes, íconos y fuentes del sitio: primero la copia, y se guardan a medida que se piden (con un tope).
//  - Los datos del tema (/theme/*.json): primero la red, con la copia como respaldo.
//  - Todo lo demás pasa directo a la red.
// El reto del día se calcula en el navegador con la fecha y los datos de la franquicia que ya vienen en la página guardada,
// así que sin red sale el mismo reto que con red ese día. Para invalidar todo, subir VERSION.

const VERSION = 'v1';
const PAGES = `ag-pages-${VERSION}`;
const STATIC = `ag-static-${VERSION}`;
const MEDIA = `ag-media-${VERSION}`;
const KEEP = [PAGES, STATIC, MEDIA];
const OFFLINE_URL = '/sin-conexion';
/** Cuánto se espera a la red antes de usar la página guardada (si hay). */
const NETWORK_TIMEOUT_MS = 4000;
/** Imágenes guardadas como máximo: al pasarse, se descartan las más viejas. */
const MEDIA_LIMIT = 800;

self.addEventListener('install', (event) => {
  event.waitUntil(precacheOffline().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name.startsWith('ag-') && !KEEP.includes(name)).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(navigation(request));
  } else if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC));
  } else if (/^\/(img|theme|themes|icons|og)\//.test(url.pathname) && /\.(png|jpe?g|webp|avif|gif|svg|ico|woff2?)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request, MEDIA, MEDIA_LIMIT));
  } else if (/^\/theme\/.*\.json$/.test(url.pathname)) {
    event.respondWith(networkFirst(request, MEDIA));
  }
});

/** Guarda la página "Sin conexión" con sus archivos, para que se vea con estilo aunque nunca se haya abierto con red. */
async function precacheOffline() {
  const response = await fetch(OFFLINE_URL, { cache: 'reload' });
  if (!response.ok) return;
  const html = await response.clone().text();
  const pages = await caches.open(PAGES);
  await pages.put(OFFLINE_URL, response);
  const assets = [...new Set([...html.matchAll(/["'(](\/_next\/static\/[^"'()\s\\]+)/g)].map((match) => match[1]))];
  const statics = await caches.open(STATIC);
  await Promise.all(assets.map((asset) => statics.add(asset).catch(() => undefined)));
}

/** Primero la red (con tope de espera); si no hay, la copia de esa página; si tampoco, "Sin conexión". */
async function navigation(request) {
  const cache = await caches.open(PAGES);
  // El juego agrega `?s=` (filtros) a la dirección al abrirse: la misma página con otro `?` es la misma copia sin conexión.
  const cached = async () => (await cache.match(request)) ?? (await cache.match(request, { ignoreSearch: true }));
  try {
    const response = await withTimeout(fetch(request), NETWORK_TIMEOUT_MS, cached);
    if (response.ok && response.type === 'basic') cache.put(request, response.clone());
    return response;
  } catch {
    return (await cached()) ?? (await cache.match(OFFLINE_URL)) ?? Response.error();
  }
}

/** Espera a `promise`; si pasa `ms` y hay una copia (`fallback`), la usa. Sin copia, sigue esperando a la red. */
function withTimeout(promise, ms, fallback) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(async () => {
      const copy = await fallback();
      if (copy && !settled) {
        settled = true;
        resolve(copy);
      }
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        if (!settled) {
          settled = true;
          resolve(value);
        }
      },
      (error) => {
        clearTimeout(timer);
        if (!settled) {
          settled = true;
          reject(error);
        }
      },
    );
  });
}

async function cacheFirst(request, name, limit) {
  const cache = await caches.open(name);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    if (limit) trim(cache, limit);
  }
  return response;
}

async function networkFirst(request, name) {
  const cache = await caches.open(name);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw new Error('sin conexión');
  }
}

/** Descarta las entradas más viejas (las primeras guardadas) cuando se pasa el tope. */
async function trim(cache, limit) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - limit))) await cache.delete(key);
}
