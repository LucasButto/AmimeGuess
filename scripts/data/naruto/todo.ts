// Sección de docs/CONTENT_TODO.md con lo que falta cargar a mano para Naruto: las imágenes (las de
// Fandom no se pueden bajar por script), el punto focal del ojo y lo que espera verificación.
// Está entre dos marcas: cada corrida del script reemplaza solo lo que hay entre ellas y deja el
// resto del archivo (otras franquicias) como está.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileUrl, pageUrl } from './wiki.ts';

export const TODO_START = '<!-- naruto:start -->';
export const TODO_END = '<!-- naruto:end -->';

/** Una imagen que falta: dónde guardarla y de qué página de Narutopedia sacarla. */
export interface MissingImage {
  readonly id: string;
  readonly name: string;
  /** Ruta de la carpeta de imágenes a mano, relativa a la raíz del proyecto, sin extensión. */
  readonly file: string;
  /** Título de la página de Narutopedia donde está la imagen. */
  readonly wikiPage: string;
  /** Nombre del archivo de la imagen en Narutopedia, si se conoce (así se llega directo a su página). */
  readonly wikiFile?: string;
  readonly note?: string;
}

export interface TodoInput {
  readonly characters: readonly MissingImage[];
  readonly jutsus: readonly MissingImage[];
  /** Imágenes ya cargadas que tienen fondo: no sirven para Silueta. */
  readonly opaque: ReadonlyArray<{ id: string; name: string }>;
  readonly charactersWithImage: number;
  readonly jutsuPoolMinimum: number;
  /** Cuántos personajes distintos son respuesta de algún jutsu con imagen: el pool del modo Jutsu cuenta esos, no los jutsu. */
  readonly jutsuAnswersWithImage: number;
  readonly quotesUnverified: number;
  readonly quotesTotal: number;
  readonly quotePoolMinimum: number;
  readonly quoteAnswersVerified: number;
}

function table(items: readonly MissingImage[], withNote: boolean): string[] {
  const lines = withNote
    ? ['| Nombre | Responde | Archivo (png, jpg o webp) | Dónde buscarla |', '|---|---|---|---|']
    : ['| Nombre | Archivo (png, jpg o webp) | Dónde buscarla |', '|---|---|---|'];
  for (const item of items) {
    const where = [`[${item.wikiPage}](${pageUrl(item.wikiPage)})`];
    if (item.wikiFile !== undefined) where.push(`[${item.wikiFile}](${fileUrl(item.wikiFile)})`);
    if (withNote) lines.push(`| ${item.name} | ${item.note ?? ''} | \`${item.file}\` | ${where.join(' · ')} |`);
    else lines.push(`| ${item.name} | \`${item.file}\` | ${where.join(' · ')} |`);
  }
  return lines;
}

export function renderTodoSection(input: TodoInput): string {
  const lines: string[] = [TODO_START, '', '## Naruto · pendientes de contenido', ''];
  lines.push(
    'Dattebayo API y Narutopedia sirven sus imágenes desde `static.wikia.nocookie.net`, que responde con un desafío anti-bots de Cloudflare a cualquier cliente que no sea un navegador. El script no intenta saltearlo (misma decisión que en Dragon Ball, sesión 08): **ninguna imagen de Naruto se descarga sola**.',
    '',
    'Para cada una: abrí la página indicada en el navegador, guardá la imagen principal (cuanto más grande mejor) con el nombre de la columna "Archivo" y volvé a correr `npm run data:naruto`. El script la convierte a WebP en dos tamaños, la suma al dataset y quita la fila de esta lista. Este bloque lo reescribe el script en cada corrida.',
    '',
  );

  lines.push(`### Personajes sin imagen (${input.characters.length}; con imagen: ${input.charactersWithImage})`, '');
  if (input.characters.length === 0) lines.push('Ninguno.');
  else {
    lines.push(
      'Sin imagen siguen jugando en el Clásico y en los modos de texto, pero no pueden ser la respuesta de Silueta, Borroso, Zoom ni Ojo. Las capturas de personaje de Narutopedia suelen ser recortes con fondo transparente (sirven también para Silueta); si alguna trae fondo, queda en la lista de más abajo.',
      '',
      ...table(input.characters, false),
    );
  }
  lines.push('');

  lines.push(`### Jutsus sin imagen (${input.jutsus.length})`, '');
  if (input.jutsus.length === 0) lines.push('Ninguno.');
  else {
    const missing = Math.max(0, input.jutsuPoolMinimum - input.jutsuAnswersWithImage);
    lines.push(
      `El modo Jutsu adivina quién usa el jutsu, así que su pool se cuenta en personajes distintos que son respuesta (columna "Responde"), no en jutsus: queda oculto hasta tener imagen de jutsus de al menos ${input.jutsuPoolMinimum} personajes distintos (ahora hay ${input.jutsuAnswersWithImage}${missing > 0 ? `; faltan ${missing}` : ''}). La imagen es la de la infobox de la página del jutsu; la captura puede ser de cualquier escena.`,
      '',
      ...table(input.jutsus, true),
    );
  }
  lines.push('');

  lines.push(`### Imágenes con fondo, que no sirven para Silueta (${input.opaque.length})`, '');
  if (input.opaque.length === 0) {
    lines.push(input.charactersWithImage === 0 ? 'Todavía no hay imágenes cargadas: cuando las haya, esta lista dirá cuántas tienen fondo.' : 'Ninguna.');
  } else {
    lines.push(
      'Quedan fuera del pool de Silueta (`imagenTransparente: 0`) pero sirven para Borroso, Zoom y Ojo. Quitarles el fondo con un paso automático necesita una dependencia nueva: **hay que decidirlo** (la sesión 10 pide frenar y preguntar antes). Mientras tanto, se puede reemplazar cada una por una versión recortada con el mismo nombre de archivo en `data-src/naruto/images/characters/`.',
      '',
      ...input.opaque.map((item) => `- ${item.name} (\`${item.id}\`)`),
    );
  }
  lines.push('');

  lines.push('### Punto focal del ojo (`data-src/naruto/focus.json`)', '');
  lines.push(
    'El modo Ojo hace zoom sobre el ojo del personaje. Para eso hace falta, por personaje con imagen, el punto `{ "character": "<id>", "x": 0.5, "y": 0.4, "verified": false }` (x e y entre 0 y 1, medidos sobre la imagen cuadrada de 512 px). Hoy el archivo está vacío porque no hay imágenes para mirar; el modo queda oculto hasta tener al menos 10 personajes con imagen y punto.',
    '',
  );

  lines.push('### Frases sin verificar', '');
  lines.push(
    `Las ${input.quotesTotal} frases de \`data-src/naruto/quotes.json\` están en español traducidas por mí a partir de la sección "Quotes" de Narutopedia (el original en inglés está en el campo \`context\` de cada una) y marcadas \`verified: false\`: hay ${input.quotesUnverified} sin verificar. Las frases sin verificar no entran al pool de producción, así que el modo Frase queda oculto hasta que se revisen y haya frases verificadas de al menos ${input.quotePoolMinimum} personajes distintos (ahora hay ${input.quoteAnswersVerified}). Para verificar: comprobar la traducción, el destinatario y el arco, y cambiar \`verified\` a \`true\`.`,
  );
  lines.push('', TODO_END);
  return lines.join('\n');
}

/** Inserta la sección entre las marcas del archivo; si no hay marcas, la agrega al final. */
export async function writeTodoSection(file: string, section: string): Promise<void> {
  let current = '';
  try {
    current = await readFile(file, 'utf8');
  } catch {
    // No existe todavía.
  }
  const start = current.indexOf(TODO_START);
  const end = current.indexOf(TODO_END);
  let next: string;
  if (start >= 0 && end > start) {
    next = `${current.slice(0, start)}${section}${current.slice(end + TODO_END.length)}`;
  } else {
    const base = current.endsWith('\n') || current === '' ? current : `${current}\n`;
    next = `${base}${base === '' ? '' : '\n'}${section}\n`;
  }
  if (next === current) return;
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, next);
}
