// Narutopedia (API MediaWiki): la infobox de cada jutsu. Se pide solo la sección 0 de las páginas
// de los jutsu que figuran en el dataset, de a 50 por solicitud. Las respuestas quedan en caché.

import { NARUTOPEDIA, NARUTOPEDIA_API, getJson } from './api.ts';
import { wikiPagesSchema } from './schemas.ts';
import { cleanValue, parseJutsuInfo, type JutsuInfo } from './transform.ts';

const BATCH = 50;

export interface WikiJutsu extends JutsuInfo {
  /** Título definitivo de la página, después de normalizar y seguir redirecciones. */
  readonly title: string;
}

/** Un título que la API podría malinterpretar (separa por "|") o que no puede ser el de un jutsu. */
function askable(title: string): boolean {
  return title.length > 0 && title.length <= 120 && !/[|#<>[\]{}]/.test(title);
}

/** Los nombres de jutsu de las fuentes, sin notas ("(Anime only)"), sin repetir y que se pueden pedir. */
export function jutsuTitles(names: Iterable<string>): string[] {
  const titles = new Set<string>();
  for (const name of names) {
    const title = cleanValue(name);
    if (title !== null && askable(title)) titles.add(title);
  }
  return [...titles].sort();
}

/**
 * La infobox de cada título pedido (`null` si la página no existe). La clave es el título tal como se
 * pidió; las redirecciones ("Rasenshuriken" → "Wind Release: Rasenshuriken") se siguen.
 */
export async function fetchJutsuInfos(titles: readonly string[]): Promise<Map<string, WikiJutsu | null>> {
  const result = new Map<string, WikiJutsu | null>();
  for (let start = 0; start < titles.length; start += BATCH) {
    const batch = titles.slice(start, start + BATCH);
    const params = new URLSearchParams({
      action: 'query',
      titles: batch.join('|'),
      prop: 'revisions',
      rvprop: 'content',
      rvslots: 'main',
      rvsection: '0',
      redirects: '1',
      format: 'json',
      formatversion: '2',
    });
    const response = await getJson(`${NARUTOPEDIA_API}?${params.toString()}`, wikiPagesSchema, NARUTOPEDIA);
    const normalized = new Map((response.query.normalized ?? []).map((item) => [item.from, item.to]));
    const redirects = new Map((response.query.redirects ?? []).map((item) => [item.from, item.to]));
    const pages = new Map(response.query.pages.map((page) => [page.title, page]));
    for (const requested of batch) {
      const normal = normalized.get(requested) ?? requested;
      const title = redirects.get(normal) ?? normal;
      const page = pages.get(title);
      const content = page?.revisions?.[0]?.slots.main.content;
      result.set(requested, page === undefined || page.missing || content === undefined ? null : { title, ...parseJutsuInfo(content) });
    }
  }
  return result;
}

/** Dirección de una página de Narutopedia a partir de su título. */
export function pageUrl(title: string): string {
  return `https://naruto.fandom.com/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

/** Dirección de la página de un archivo de Narutopedia (la imagen de un jutsu o de un personaje). */
export function fileUrl(fileName: string): string {
  return `https://naruto.fandom.com/wiki/File:${encodeURIComponent(fileName.replace(/ /g, '_'))}`;
}
