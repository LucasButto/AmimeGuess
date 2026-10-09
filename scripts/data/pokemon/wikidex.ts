// Descripciones de la Pokédex en español tomadas de WikiDex, solo para las
// especies a las que PokéAPI no les trae ninguna (hoy, Leyendas Arceus y la
// novena generación). WikiDex transcribe el texto oficial de cada juego en la
// plantilla {{Pokédex}} de la página del Pokémon; acá se lee esa plantilla tal
// cual, sin redactar nada. Como es una transcripción de la comunidad y no un
// dato oficial de una API, el contenido nace con `verified: false`.
//
// Sin red ni disco: la descarga está en build.ts.

import { z } from 'zod';

export const WIKIDEX_API = 'https://www.wikidex.net/api.php';

/** URL de la API de MediaWiki que devuelve el wikitexto de una página (sigue redirecciones). */
export function wikidexUrl(page: string): string {
  const params = new URLSearchParams({ action: 'parse', page, prop: 'wikitext', redirects: '1', format: 'json' });
  return `${WIKIDEX_API}?${params.toString()}`;
}

export const wikidexParseSchema = z.union([
  z.object({ parse: z.object({ title: z.string(), wikitext: z.object({ '*': z.string() }) }) }),
  z.object({ error: z.object({ code: z.string(), info: z.string() }) }),
]);

export type WikidexParse = z.infer<typeof wikidexParseSchema>;

/**
 * Juegos de la plantilla, del más reciente al más viejo, con el nombre de la
 * versión en PokéAPI (el mismo que usan las descripciones que vienen de ahí).
 */
const GAMES: ReadonlyArray<readonly [string, string]> = [
  ['escarlata', 'scarlet'],
  ['púrpura', 'violet'],
  ['leyendas Arceus', 'legends-arceus'],
];

/**
 * Lee los campos `| clave = valor` de la primera plantilla {{Pokédex}} del
 * wikitexto. Un valor puede seguir en las líneas siguientes (las especies con
 * varias formas traen una viñeta por forma).
 */
export function parseDexTemplate(wikitext: string): Map<string, string> {
  const fields = new Map<string, string>();
  const start = wikitext.indexOf('{{Pokédex');
  if (start === -1) return fields;
  const end = wikitext.indexOf('\n}}', start);
  if (end === -1) return fields;
  let current: string | undefined;
  for (const line of wikitext.slice(start, end).split('\n').slice(1)) {
    const match = /^\s*\|\s*([^=|]+?)\s*=\s*(.*)$/.exec(line);
    if (match) {
      current = match[1];
      fields.set(current, match[2].trim());
    } else if (current !== undefined) {
      fields.set(current, `${fields.get(current)}\n${line.trim()}`.trim());
    }
  }
  return fields;
}

/**
 * El texto en español de España: `{{n|…|…}}` y `{{NombreHaEs|…|…}}` traen
 * primero la versión de Hispanoamérica y después la de España, que es la que
 * usan las descripciones de PokéAPI.
 */
function spainVariant(raw: string): string {
  return raw.replace(/\{\{(?:n|NombreHaEs)\|([^{}|]*)\|([^{}|]*)\}\}/g, '$2');
}

/** Si hay una viñeta por forma, la de la primera forma sin su rótulo en negrita. */
function firstForm(raw: string): string {
  if (!raw.trimStart().startsWith('*')) return raw;
  const first = raw.split('\n').find((line) => line.trim().startsWith('*')) ?? '';
  return first.replace(/^\s*\*\s*/, '').replace(/^'''[^']*?:'''\s*/, '');
}

/** Quita el marcado de enlaces y negritas; si queda otra plantilla o algo raro, no sirve. */
function cleanWikitext(raw: string): string | undefined {
  const text = firstForm(spainVariant(raw))
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/'{2,}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length === 0 || /[{}[\]<>|=*]/.test(text)) return undefined;
  // Aviso de WikiDex para una forma sin entrada en ese juego (Ursaluna en Escarlata).
  if (/^no hay entrada\b/i.test(text)) return undefined;
  return text;
}

/**
 * La descripción del juego más reciente que la tiene. Un valor puede remitir a
 * otro juego de la plantilla ("go = escarlata"); "no hay" significa que ese
 * juego no tiene descripción.
 */
export function pickWikidexText(fields: ReadonlyMap<string, string>): { text: string; version: string } | undefined {
  const resolve = (key: string, depth = 0): string | undefined => {
    const value = fields.get(key);
    if (value === undefined || depth > 3) return undefined;
    if (fields.has(value)) return resolve(value, depth + 1);
    return value;
  };
  for (const [key, version] of GAMES) {
    const value = resolve(key);
    if (value === undefined || value.toLowerCase() === 'no hay') continue;
    const text = cleanWikitext(value);
    if (text !== undefined) return { text, version };
  }
  return undefined;
}

/** Texto de la Pokédex a partir de la respuesta de la API, o `undefined` si la página no lo tiene. */
export function wikidexDexText(response: WikidexParse): { text: string; version: string } | undefined {
  if (!('parse' in response)) return undefined;
  return pickWikidexText(parseDexTemplate(response.parse.wikitext['*']));
}
