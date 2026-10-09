// Fuentes de datos de Yu-Gi-Oh (SPEC sección 7). El cliente HTTP es el de Dragon Ball (caché en
// disco, concurrencia por fuente, reintentos); acá solo se declaran las fuentes de Yu-Gi-Oh y su
// caché, en .cache/yugioh/ (ignorada por git).
//
// - YGOPRODeck: stats, id, konami_id e imágenes de las cartas. 20 solicitudes por segundo como
//   máximo; se usan hasta 8 (una cada 125 ms). Prohíbe el hotlinking: cada imagen se baja una sola
//   vez y se sirve desde public/.
// - YGOResources: nombre y texto oficiales en español (clave `es`). Pide no bajar la base entera:
//   solo se consultan las cartas del pool, y cada respuesta queda en caché.
// - Yugipedia: páginas de los duelistas (infobox, listas de deck) y su imagen. Sus imágenes sí se
//   pueden bajar desde un script (ms.yugipedia.com no usa un desafío de Cloudflare).
// - Yu-Gi-Oh! Wiki de Fandom (API MediaWiki): categorías de personajes por serie. Solo texto: sus
//   imágenes están tras un desafío de Cloudflare y no se intenta saltearlo.
// Se consultan solo desde los scripts de datos, nunca desde el sitio.

import path from 'node:path';
import { ROOT, getFile, getJson, mapPool, type Source } from '../dragon-ball/api.ts';

export { ROOT, getFile, getJson, mapPool };

export const YGOPRODECK_API = 'https://db.ygoprodeck.com/api/v7/cardinfo.php';
export const YGORESOURCES_BASE = 'https://db.ygoresources.com/data/card';
export const YUGIPEDIA_API = 'https://yugipedia.com/api.php';
export const FANDOM_API = 'https://yugioh.fandom.com/api.php';

const cache = (name: string) => path.join(ROOT, '.cache', 'yugioh', name);

export const YGOPRODECK: Source = { name: 'ygoprodeck', cacheDir: cache('ygoprodeck'), pathPrefix: '/api/v7/', concurrency: 2, minIntervalMs: 125 };
export const YGORESOURCES: Source = { name: 'ygoresources', cacheDir: cache('ygoresources'), pathPrefix: '/data/', concurrency: 2, minIntervalMs: 200 };
export const YUGIPEDIA: Source = { name: 'yugipedia', cacheDir: cache('yugipedia'), pathPrefix: '/', concurrency: 2, minIntervalMs: 250 };
export const FANDOM: Source = { name: 'yugioh-fandom', cacheDir: cache('fandom'), pathPrefix: '/', concurrency: 2, minIntervalMs: 300 };
