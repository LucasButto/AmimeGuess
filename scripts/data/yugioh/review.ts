// Documento de revisión de Yu-Gi-Oh (docs/REVISION_YUGIOH.md): la lista completa de duelistas y de cartas
// insignia agrupada por serie, con lo que hay que mirar para pasar `verified` a true. Lo genera el build en
// cada corrida, así siempre coincide con data-src/yugioh/.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { DuelistSrc, SeriesId, Translations } from './schemas.ts';
import type { Evidence } from './transform.ts';

export interface ReviewCard {
  readonly english: string;
  readonly spanish: string;
  readonly iconicity: number;
  readonly ace: boolean;
  readonly evidence: Evidence;
  /** Otros duelistas que también la tienen entre sus cartas insignia. */
  readonly sharedWith: readonly string[];
}

export interface ReviewDuelist {
  readonly src: DuelistSrc;
  readonly gender: string;
  readonly firstAppearance: string;
  readonly summoning: readonly string[];
  readonly image: 'yugipedia' | 'manual' | 'ninguna';
  readonly cards: readonly ReviewCard[];
}

const dots = (iconicity: number) => '●'.repeat(iconicity) + '○'.repeat(3 - iconicity);

function renderCard(card: ReviewCard): string {
  const name = card.spanish === card.english ? card.english : `${card.spanish} (${card.english})`;
  const marks = [card.ace ? '★ as' : '', card.evidence === 'page' ? '⚠ solo mencionada en Yugipedia' : '', card.sharedWith.length > 0 ? `también de ${card.sharedWith.join(', ')}` : '']
    .filter((mark) => mark !== '')
    .join(' · ');
  return `- ${dots(card.iconicity)} ${name}${marks === '' ? '' : ` — ${marks}`}`;
}

export function renderReview(duelists: readonly ReviewDuelist[], series: readonly SeriesId[], translations: Translations): string {
  const lines: string[] = [
    '# Yu-Gi-Oh · revisión de duelistas y cartas insignia',
    '',
    'Lo genera `npm run data:yugioh` (sesión 12) con lo que hay en `data-src/yugioh/`; no se edita a mano. Para corregir algo: cambiá `duelists.json`, `signature-cards.json` o `summons.json` y volvé a correr el script. Cuando una lista esté bien, pasá su `verified` a `true`.',
    '',
    'Qué revisar:',
    '',
    '- **Rol, afiliaciones y arquetipos** de cada duelista: los redactó una IA a partir de la infobox de Yugipedia (escuela, dormitorio, organización, equipo y deck de anime). Son valores de comparación del Clásico, así que los nombres tienen que repetirse igual entre duelistas que comparten algo.',
    '- **Cartas insignia**: que sean reconocibles como propias de ese duelista (ante la duda, sacala). La puntuación ●○○ a ●●● es la iconicidad: el modo Deck las revela de menos a más icónica y la carta as (★) es la imagen de Carta insignia, así que tiene que ser inconfundible y no repetirse entre duelistas.',
    '- ⚠ marca las cartas que Yugipedia solo menciona en la página del duelista (no en una lista de deck).',
    '- Género y primera aparición salen de la infobox de Yugipedia y los nombres de las cartas, de YGOResources: no hay que revisarlos, salvo que algo se vea mal.',
    '',
  ];
  for (const id of series) {
    const group = duelists.filter((item) => item.src.series[0] === id);
    if (group.length === 0) continue;
    const total = group.reduce((sum, item) => sum + item.cards.length, 0);
    lines.push(`## ${translations.series[id]} (${group.length} duelistas, ${total} cartas)`, '');
    for (const item of group) {
      const { src } = item;
      lines.push(
        `### ${src.name}`,
        '',
        `${src.role} · ${item.gender} · primera aparición: ${item.firstAppearance}`,
        '',
        `- Afiliaciones: ${src.affiliations.length > 0 ? src.affiliations.join(', ') : '(ninguna)'}`,
        `- Arquetipos: ${src.decks.join(', ')}`,
        `- Invocación (sale de sus cartas): ${item.summoning.join(', ')}`,
        `- Alias: ${src.aliases.length > 0 ? src.aliases.join(', ') : '(ninguno)'}`,
        `- Imagen: ${item.image === 'ninguna' ? 'sin imagen' : item.image === 'manual' ? 'cargada a mano' : `de Yugipedia${src.imageFile === undefined ? '' : ` (archivo ${src.imageFile})`}`}`,
        '',
        `Cartas insignia (${item.cards.length}), de la más a la menos icónica:`,
        '',
        ...[...item.cards].sort((a, b) => b.iconicity - a.iconicity || Number(b.ace) - Number(a.ace) || a.english.localeCompare(b.english)).map(renderCard),
        '',
      );
    }
  }
  return `${lines.join('\n')}`;
}

export async function writeReview(file: string, text: string): Promise<void> {
  try {
    if ((await readFile(file, 'utf8')) === text) return;
  } catch {
    // No existe todavía.
  }
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text);
}
