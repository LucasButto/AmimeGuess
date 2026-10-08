// Sección de docs/CONTENT_TODO.md con las imágenes de Dragon Ball que hay que cargar a mano.
// Está entre dos marcas: cada corrida del script reemplaza solo lo que hay entre ellas
// y deja el resto del archivo (otras franquicias) como está.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const TODO_START = '<!-- dragon-ball:start -->';
export const TODO_END = '<!-- dragon-ball:end -->';

/** Una imagen que falta: dónde guardarla y de qué página de la wiki sacarla. */
export interface MissingImage {
  readonly id: string;
  readonly name: string;
  /** Ruta de la carpeta de imágenes a mano, relativa a la raíz del proyecto, sin extensión. */
  readonly file: string;
  /** Título de la página de la wiki en español donde está la imagen. */
  readonly wikiPage: string;
  readonly note?: string;
}

export interface OpaqueImage {
  readonly id: string;
  readonly name: string;
}

export interface TodoInput {
  readonly characters: readonly MissingImage[];
  readonly techniques: readonly MissingImage[];
  readonly opaque: readonly OpaqueImage[];
  readonly techniquePoolMinimum: number;
  /** Cuántos personajes distintos son respuesta de alguna técnica con imagen: el pool del modo Técnica cuenta esos, no las técnicas. */
  readonly techniqueAnswersWithImage: number;
}

const wikiUrl = (page: string) => `https://dragonball.fandom.com/es/wiki/${encodeURIComponent(page.replace(/ /g, '_'))}`;

function table(items: readonly MissingImage[], answers = false): string[] {
  const lines = answers
    ? ['| Nombre | Responde | Archivo (png, jpg o webp) | Dónde buscarla |', '|---|---|---|---|']
    : ['| Nombre | Archivo (png, jpg o webp) | Dónde buscarla |', '|---|---|---|'];
  for (const item of items) {
    const link = `[${item.wikiPage}](${wikiUrl(item.wikiPage)})`;
    if (answers) lines.push(`| ${item.name} | ${item.note ?? ''} | \`${item.file}\` | ${link} |`);
    else lines.push(`| ${item.name}${item.note === undefined ? '' : ` — ${item.note}`} | \`${item.file}\` | ${link} |`);
  }
  return lines;
}

export function renderTodoSection(input: TodoInput): string {
  const lines: string[] = [TODO_START, '', '## Dragon Ball · imágenes para cargar a mano', ''];
  lines.push(
    'Las imágenes de Dragon Ball API (58 personajes y 43 formas) se descargan solas. Las de la wiki de Fandom no: su CDN (`static.wikia.nocookie.net`) responde con un desafío anti-bots de Cloudflare a cualquier cliente que no sea un navegador, y el script no intenta saltearlo (sesión 08).',
    '',
    'Para cada una: abrí la página indicada en el navegador, guardá la imagen principal (cuanto más grande mejor; las de fondo transparente sirven también para Silueta) con el nombre de la columna "Archivo" y volvé a correr `npm run data:dragon-ball`. El script la convierte a WebP en dos tamaños, la suma al dataset y quita la fila de esta lista. Este bloque lo reescribe el script en cada corrida.',
    '',
  );

  lines.push(`### Personajes sin imagen (${input.characters.length})`, '');
  if (input.characters.length === 0) lines.push('Ninguno.');
  else {
    lines.push(
      'Sin imagen siguen jugando en el Clásico, pero no pueden ser la respuesta de Silueta, Borroso ni Zoom.',
      '',
      ...table(input.characters),
    );
  }
  lines.push('');

  lines.push(`### Técnicas sin imagen (${input.techniques.length})`, '');
  if (input.techniques.length === 0) lines.push('Ninguna.');
  else {
    const missingToOpen = Math.max(0, input.techniquePoolMinimum - input.techniqueAnswersWithImage);
    lines.push(
      `El modo Técnica adivina quién usa la técnica, así que su pool se cuenta en personajes distintos que son respuesta (columna "Responde"), no en técnicas: queda oculto hasta tener imagen de técnicas de al menos ${input.techniquePoolMinimum} personajes distintos (ahora hay ${input.techniqueAnswersWithImage}${missingToOpen > 0 ? `; faltan ${missingToOpen}` : ''}). La captura puede ser de cualquier escena de la técnica; si no es de la serie anotada en \`techniques.json\`, corregí el campo \`series\` de esa técnica.`,
      '',
      ...table(input.techniques, true),
    );
  }
  lines.push('');

  lines.push(`### Imágenes con fondo, que no sirven para Silueta (${input.opaque.length})`, '');
  if (input.opaque.length === 0) lines.push('Ninguna.');
  else {
    lines.push(
      'Quedan fuera del pool de Silueta (`imagenTransparente: 0`) pero sirven para Borroso y Zoom. Para que entren, reemplazalas por una versión recortada con fondo transparente (mismo nombre de archivo en `data-src/dragon-ball/images/`).',
      '',
      ...input.opaque.map((item) => `- ${item.name} (\`${item.id}\`)`),
    );
  }
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
