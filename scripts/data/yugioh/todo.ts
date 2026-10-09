// Sección de docs/CONTENT_TODO.md con lo que queda pendiente de Yu-Gi-Oh: imágenes de duelistas que no se
// pudieron conseguir, cartas sin texto en español y cartas con respaldo débil. Está entre dos marcas: cada
// corrida del script reemplaza solo lo que hay entre ellas y deja el resto del archivo como está.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const TODO_START = '<!-- yugioh:start -->';
export const TODO_END = '<!-- yugioh:end -->';

export interface MissingDuelistImage {
  readonly id: string;
  readonly name: string;
  /** Página de Yugipedia donde está la imagen principal. */
  readonly wikiPage: string;
}

export interface TodoInput {
  readonly duelists: number;
  readonly cards: number;
  readonly series: readonly string[];
  readonly missingImages: readonly MissingDuelistImage[];
  readonly imagesFromYugipedia: number;
  readonly imagesManual: number;
  /** Cartas sin clave `es` en YGOResources: quedan fuera del modo Texto y se muestran con su nombre en inglés. */
  readonly withoutSpanish: ReadonlyArray<{ name: string; owners: string }>;
  /** Cartas cuyo único respaldo en Yugipedia es una mención en la página del duelista, no su lista de deck. */
  readonly weakEvidence: ReadonlyArray<{ duelist: string; card: string }>;
  readonly unverified: { readonly duelists: number; readonly cards: number; readonly summons: number };
  readonly imageBytesProject: number;
}

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function pageUrl(title: string): string {
  return `https://yugipedia.com/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

export function renderTodoSection(input: TodoInput): string {
  const lines: string[] = [TODO_START, '', '## Yu-Gi-Oh · pendientes de contenido', ''];
  lines.push(
    `Hay ${input.duelists} duelistas y ${input.cards} cartas insignia de las series ${input.series.join(', ')} (decisión de la sesión 12: solo Duel Monsters, GX y 5D's por ahora; ZEXAL, ARC-V y VRAINS se suman después con sus duelistas en \`data-src/yugioh/\`). Todo lo curado está sin verificar: ${input.unverified.duelists} duelistas (rol, afiliaciones y arquetipos redactados a partir de la infobox de Yugipedia), ${input.unverified.cards} listas de cartas insignia y ${input.unverified.summons} invocaciones. Los nombres y textos de las cartas, el género y la primera aparición no se redactan: vienen de YGOResources y de Yugipedia.`,
    '',
  );

  lines.push(
    '### Imágenes de duelistas',
    '',
    `${input.imagesFromYugipedia} salen de Yugipedia (la imagen de su página, recortada al cuadrado desde su centro) y ${input.imagesManual} están cargadas a mano en \`data-src/yugioh/images/duelists/<id>.png\`. Son cuadros de anime o renders anchos: si alguna se recortó mal (la cara quedó cortada), reemplazala con una imagen mejor con el nombre \`<id>.png\` (o \`.jpg\`, \`.webp\`) en esa carpeta y corré \`npm run data:yugioh\`.`,
    '',
  );
  if (input.missingImages.length > 0) {
    lines.push(
      `Sin imagen (${input.missingImages.length}): siguen jugando en el Clásico y en los modos de texto, pero sin foto. Su página en Yugipedia no tiene imagen principal.`,
      '',
      '| Duelista | Archivo (png, jpg o webp) | Dónde buscarla |',
      '|---|---|---|',
      ...input.missingImages.map((item) => `| ${item.name} | \`data-src/yugioh/images/duelists/${item.id}\` | [${item.wikiPage}](${pageUrl(item.wikiPage)}) |`),
      '',
    );
  } else {
    lines.push('Hoy ningún duelista se queda sin imagen.', '');
  }

  lines.push(
    '### Silueta',
    '',
    'Ninguna ilustración de carta sirve para Silueta: todas son un cuadro con fondo, sin canal alfa (`imagenTransparente: 0`). Cuando se arme el modo Silueta de Yu-Gi-Oh (sesión 13) va a quedar oculto por pool, igual que en Naruto, hasta que haya una forma de recortar los fondos (requiere una dependencia nueva, así que hay que decidirlo).',
    '',
  );

  lines.push('### Cartas sin texto en español', '');
  if (input.withoutSpanish.length === 0) {
    lines.push('Todas las cartas tienen nombre y texto oficiales en español en YGOResources.', '');
  } else {
    lines.push(
      `YGOResources no tiene la clave \`es\` de estas ${input.withoutSpanish.length} cartas. Se muestran con su nombre oficial en inglés (que es también el alias) y quedan fuera del modo Texto. No se tradujeron ni se inventó ningún texto.`,
      '',
      ...input.withoutSpanish.map((item) => `- ${item.name} (${item.owners})`),
      '',
    );
  }

  lines.push('### Respaldo débil en Yugipedia', '');
  if (input.weakEvidence.length === 0) {
    lines.push('Todas las cartas aparecen en alguna lista de deck de las páginas de su duelista.', '');
  } else {
    lines.push(
      `Estas ${input.weakEvidence.length} cartas no figuran en ninguna lista de deck de las páginas de su duelista en Yugipedia, solo se las menciona en la página. Son cartas conocidas de su duelista, pero conviene revisarlas:`,
      '',
      ...input.weakEvidence.map((item) => `- ${item.duelist}: ${item.card}`),
      '',
    );
  }

  lines.push(
    '### Presupuesto de imágenes',
    '',
    `\`public/img\` pesa ${mb(input.imageBytesProject)} de los 200 MB de la SPEC (7). Si se suman más series o más cartas, la ilustración de cada carta cuesta ~50 KB (256 y 512 px) y cada carta entera de una carta as ~40 KB.`,
    '',
    TODO_END,
  );
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
