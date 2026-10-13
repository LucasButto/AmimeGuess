import type { Content } from '@/engine/types';

// Atribución del texto CC BY-SA que se reutiliza (SPEC 10). Todo contenido copiado o traducido de una wiki guarda
// su página de origen en `payload.source`; acá se agrupa por sitio y por página para listarlo en /creditos.
// Sale de los datos, así un texto nuevo de una wiki queda atribuido sin tocar la página.

export interface AttributedPage {
  readonly url: string;
  readonly title: string;
  /** Cuántos contenidos salen de esta página. */
  readonly count: number;
}

export interface AttributedSite {
  /** El host de la dirección de origen (`www.wikidex.net`): identifica el sitio. */
  readonly host: string;
  readonly pages: readonly AttributedPage[];
  /** Cuántos contenidos salen del sitio, sumando todas sus páginas. */
  readonly count: number;
}

/** Título legible de una página de wiki a partir de su dirección: el último tramo, decodificado y sin guiones bajos. */
export function wikiPageTitle(url: string): string {
  const last = new URL(url).pathname.split('/').filter(Boolean).at(-1);
  return last === undefined ? url : decodeURIComponent(last).replace(/_/g, ' ');
}

/** Los contenidos con página de origen, agrupados por sitio y por página, en el orden en que aparecen en los datos. */
export function attributionsOf(contents: readonly Content[]): AttributedSite[] {
  const sites = new Map<string, Map<string, { url: string; title: string; count: number }>>();
  for (const content of contents) {
    const source = content.payload.source;
    if (typeof source !== 'string') continue;
    const host = new URL(source).host;
    const pages = sites.get(host) ?? new Map<string, { url: string; title: string; count: number }>();
    sites.set(host, pages);
    const page = pages.get(source) ?? { url: source, title: wikiPageTitle(source), count: 0 };
    page.count += 1;
    pages.set(source, page);
  }
  return [...sites].map(([host, pages]) => {
    const list = [...pages.values()];
    return { host, pages: list, count: list.reduce((sum, page) => sum + page.count, 0) };
  });
}
