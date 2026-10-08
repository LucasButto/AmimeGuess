// Fuentes de datos de Naruto (SPEC sección 7): Dattebayo API y la API MediaWiki de Narutopedia.
// El cliente HTTP es el mismo de Dragon Ball (caché en disco, concurrencia por fuente, reintentos);
// acá solo se declaran las fuentes de Naruto y su caché, en .cache/naruto/ (ignorada por git).
//
// - Dattebayo API es un proyecto de aficionados alojado en Render: puede tardar en despertar.
//   Admite hasta 5 solicitudes simultáneas; la API de Fandom, 2.
// - Se consulta solo desde los scripts de datos, nunca desde el sitio.
// - Las imágenes de Dattebayo y de Narutopedia viven en static.wikia.nocookie.net, que responde con
//   un desafío de Cloudflare a los clientes que no son un navegador: no se intenta saltearlo. Esas
//   imágenes se cargan a mano (docs/CONTENT_TODO.md), igual que las de Fandom en Dragon Ball.

import path from 'node:path';
import { ROOT, getJson, mapPool, type Source } from '../dragon-ball/api.ts';

export { ROOT, getJson, mapPool };

export const DATTEBAYO_BASE = 'https://dattebayo-api.onrender.com';
export const NARUTOPEDIA_API = 'https://naruto.fandom.com/api.php';

export const DATTEBAYO: Source = {
  name: 'dattebayo',
  cacheDir: path.join(ROOT, '.cache', 'naruto', 'dattebayo'),
  pathPrefix: '/',
  concurrency: 5,
};

export const NARUTOPEDIA: Source = {
  name: 'narutopedia',
  cacheDir: path.join(ROOT, '.cache', 'naruto', 'narutopedia'),
  pathPrefix: '/',
  concurrency: 2,
};
