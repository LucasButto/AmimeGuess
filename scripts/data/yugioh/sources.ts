// Lectura de las fuentes de Yu-Gi-Oh (SPEC sección 7). Todo pasa por el cliente con caché de api.ts.

import {
  FANDOM,
  FANDOM_API,
  YGOPRODECK,
  YGOPRODECK_API,
  YGORESOURCES,
  YGORESOURCES_BASE,
  YUGIPEDIA,
  YUGIPEDIA_API,
  getFile,
  getJson,
  mapPool,
} from './api.ts';
import {
  fandomCategorySchema,
  ygoprodeckResponseSchema,
  ygoresourcesSchema,
  yugipediaFileSchema,
  yugipediaPagesSchema,
  type YgoprodeckCard,
} from './schemas.ts';

/** Cuántos nombres de carta entran en una consulta a YGOPRODeck (`name=A|B|C`): la URL tiene que seguir siendo corta. */
const CARDS_PER_QUERY = 20;
/** Páginas de Yugipedia por consulta con su contenido. */
const PAGES_PER_QUERY = 8;

// --- YGOPRODeck ---------------------------------------------------------------

/**
 * Las cartas con esos nombres exactos, con `misc=yes` (trae el konami_id). La API ignora en silencio los nombres que no
 * existen: lo que falte en el resultado no existe. Los lotes se arman sobre los nombres ordenados, así son estables.
 */
export async function fetchCards(names: readonly string[]): Promise<Map<string, YgoprodeckCard>> {
  const sorted = [...new Set(names)].sort();
  const chunks: string[][] = [];
  for (let index = 0; index < sorted.length; index += CARDS_PER_QUERY) chunks.push(sorted.slice(index, index + CARDS_PER_QUERY));
  const responses = await mapPool(chunks, 2, async (chunk) => {
    const url = `${YGOPRODECK_API}?misc=yes&name=${encodeURIComponent(chunk.join('|'))}`;
    try {
      return (await getJson(url, ygoprodeckResponseSchema, YGOPRODECK)).data;
    } catch (error) {
      // YGOPRODeck responde 400 cuando ninguno de los nombres existe.
      throw new Error(`YGOPRODeck no devolvió cartas para: ${chunk.join(', ')} (${error instanceof Error ? error.message : String(error)})`);
    }
  });
  return new Map(responses.flat().map((card) => [card.name, card]));
}

/** La ilustración recortada y la carta entera (JPG de YGOPRODeck), una sola vez cada una (queda en la caché). */
export async function fetchCardImage(card: YgoprodeckCard, kind: 'art' | 'full'): Promise<Buffer> {
  const image = card.card_images[0];
  return getFile(kind === 'art' ? image.image_url_cropped : image.image_url, `${kind}/${image.id}.jpg`, YGOPRODECK);
}

// --- YGOResources -------------------------------------------------------------

export interface SpanishCard {
  readonly name: string;
  readonly text: string | null;
}

/** El nombre y el texto oficiales en español de una carta (clave `es`), o `null` si YGOResources no la tiene en español. */
export async function fetchSpanish(konamiId: number): Promise<SpanishCard | null> {
  const data = await getJson(`${YGORESOURCES_BASE}/${konamiId}`, ygoresourcesSchema, YGORESOURCES);
  const es = data.cardData.es;
  if (es === undefined) return null;
  return { name: es.name, text: es.effectText !== undefined && es.effectText.length > 0 ? es.effectText : null };
}

// --- Yu-Gi-Oh! Wiki de Fandom -------------------------------------------------

/** Títulos de todas las páginas de una categoría (paginado). */
export async function fetchCategoryTitles(category: string): Promise<string[]> {
  const titles: string[] = [];
  let next = '';
  do {
    const url = `${FANDOM_API}?format=json&action=query&list=categorymembers&cmtype=page&cmlimit=500&cmtitle=${encodeURIComponent(`Category:${category}`)}${next}`;
    const page = await getJson(url, fandomCategorySchema, FANDOM);
    titles.push(...page.query.categorymembers.map((member) => member.title));
    next = page.continue ? `&cmcontinue=${encodeURIComponent(page.continue.cmcontinue)}` : '';
  } while (next !== '');
  return titles;
}

// --- Yugipedia -----------------------------------------------------------------

/** El texto wiki de cada título (tras seguir redirecciones), o `null` si la página no existe. Las claves son los títulos pedidos. */
export async function fetchPageTexts(titles: readonly string[]): Promise<Map<string, string | null>> {
  const unique = [...new Set(titles)].sort();
  const chunks: string[][] = [];
  for (let index = 0; index < unique.length; index += PAGES_PER_QUERY) chunks.push(unique.slice(index, index + PAGES_PER_QUERY));
  const results = await mapPool(chunks, 2, async (chunk) => {
    const url = `${YUGIPEDIA_API}?format=json&action=query&redirects=1&prop=revisions&rvprop=content&titles=${encodeURIComponent(chunk.join('|'))}`;
    const data = (await getJson(url, yugipediaPagesSchema, YUGIPEDIA)).query;
    const aliases = new Map<string, string>();
    for (const item of [...(data.normalized ?? []), ...(data.redirects ?? [])]) aliases.set(item.from, item.to);
    const byTitle = new Map<string, string | null>();
    for (const page of Object.values(data.pages)) byTitle.set(page.title, page.missing !== undefined ? null : (page.revisions?.[0]?.['*'] ?? null));
    return chunk.map((title): [string, string | null] => {
      let resolved = title;
      for (let hops = 0; hops < 3 && aliases.has(resolved); hops++) resolved = aliases.get(resolved) as string;
      return [title, byTitle.get(resolved) ?? null];
    });
  });
  return new Map(results.flat());
}

export interface PageImage {
  readonly url: string;
  readonly width: number;
  readonly height: number;
}

/** La imagen principal de una página de Yugipedia (la de la infobox), o `null` si no tiene. */
export async function fetchPageImage(title: string): Promise<PageImage | null> {
  const url = `${YUGIPEDIA_API}?format=json&action=query&redirects=1&prop=pageimages&piprop=original&titles=${encodeURIComponent(title)}`;
  const data = (await getJson(url, yugipediaPagesSchema, YUGIPEDIA)).query;
  const page = Object.values(data.pages)[0];
  return page?.original ? { url: page.original.source, width: page.original.width, height: page.original.height } : null;
}

/** La imagen de un archivo concreto de Yugipedia (por ejemplo "Axel.jpg"), o `null` si no existe. */
export async function fetchFileImage(fileName: string): Promise<PageImage | null> {
  const url = `${YUGIPEDIA_API}?format=json&action=query&prop=imageinfo&iiprop=url|size&titles=${encodeURIComponent(`File:${fileName}`)}`;
  const data = (await getJson(url, yugipediaFileSchema, YUGIPEDIA)).query;
  const info = Object.values(data.pages)[0]?.imageinfo?.[0];
  return info ? { url: info.url, width: info.width, height: info.height } : null;
}

/** El archivo de una imagen de Yugipedia (ms.yugipedia.com). `cacheName` es la ruta dentro de la caché de archivos. */
export async function fetchImageFile(url: string, cacheName: string): Promise<Buffer> {
  return getFile(url, cacheName, YUGIPEDIA);
}
