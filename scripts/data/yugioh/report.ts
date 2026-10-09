// Informe de consola al terminar el build de Yu-Gi-Oh.

import type { Content, Entity } from '../../../src/engine/types.ts';
import type { Rendered } from './images.ts';
import { SERIES, type SeriesId } from './schemas.ts';

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
const pad = (value: string | number, width: number) => String(value).padStart(width);

export interface ReportInput {
  readonly duelists: Entity[];
  readonly cards: Entity[];
  readonly contents: Content[];
  /** Cartas insignia por duelista (id → cantidad). */
  readonly cardsPerDuelist: ReadonlyMap<string, number>;
  readonly summonCandidates: number;
  readonly withoutSpanish: string[];
  readonly weakEvidence: number;
  readonly rendered: { duelists: Rendered[]; art: Rendered[]; faces: Rendered[]; silhouettes: Rendered[] };
  readonly silhouettes: { readonly monsters: number; readonly usable: number };
  readonly images: { fromYugipedia: number; manual: number; missing: number };
  readonly unverified: { duelists: number; cards: number; summons: number };
  readonly imageBytesYugioh: number;
  readonly imageBytesProject: number;
}

function printImages(line: (text?: string) => void, label: string, images: Rendered[]): number {
  let total = 0;
  for (const size of [256, 512] as const) {
    const group = images.filter((image) => image.size === size);
    if (group.length === 0) continue;
    const sum = group.reduce((acc, image) => acc + image.bytes, 0);
    total += sum;
    const largest = group.reduce((best, image) => (image.bytes > best.bytes ? image : best));
    line(`  ${label} ${pad(size, 3)} px: ${pad(group.length, 4)} archivos, ${pad(mb(sum), 8)}, promedio ${kb(sum / group.length)}, máximo ${kb(largest.bytes)} (${largest.id})`);
  }
  return total;
}

export function printReport(input: ReportInput): void {
  const line = (text = '') => console.log(text);
  const of = (kind: string) => input.contents.filter((content) => content.kind === kind);
  const bySeries = (items: Entity[], series: SeriesId) => items.filter((item) => item.series.includes(series)).length;

  line();
  line('=== Yu-Gi-Oh · informe ===');
  line();
  line('Duelistas y cartas por serie (una carta cuenta en cada serie de sus duelistas):');
  for (const series of SERIES) {
    const duelists = bySeries(input.duelists, series);
    const cards = bySeries(input.cards, series);
    if (duelists === 0 && cards === 0) continue;
    line(`  ${series.padEnd(7)} ${pad(duelists, 3)} duelistas   ${pad(cards, 4)} cartas`);
  }
  line(`  total   ${pad(input.duelists.length, 3)} duelistas   ${pad(input.cards.length, 4)} cartas distintas`);

  const counts = [...input.cardsPerDuelist.values()];
  line();
  line(`Cartas insignia por duelista: de ${Math.min(...counts)} a ${Math.max(...counts)}, promedio ${(counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(1)}.`);
  const classes = new Map<string, number>();
  for (const card of input.cards) classes.set(String(card.attrs.clase), (classes.get(String(card.attrs.clase)) ?? 0) + 1);
  line(`Por clase: ${[...classes].sort((a, b) => b[1] - a[1]).map(([name, count]) => `${name} ${count}`).join(' · ')}`);

  line();
  line('Contenidos:');
  line(`  Texto de carta (card-text)      ${pad(of('card-text').length, 4)}   (${input.cards.length - input.withoutSpanish.length} de ${input.cards.length} cartas tienen texto en español)`);
  line(`  Decks (deck)                    ${pad(of('deck').length, 4)}`);
  const summons = of('summon');
  line(`  Invocaciones (summon)           ${pad(summons.length, 4)}   (monstruos con materiales cargados: ${new Set(summons.map((content) => content.entityId)).size})`);
  line(`  Carta as entera (ace-card)      ${pad(of('ace-card').length, 4)}`);
  line(`  Silueta del monstruo (silhouette) ${pad(of('silhouette').length, 2)}   (${input.silhouettes.usable} de ${input.silhouettes.monsters} monstruos tienen recorte que sirve)`);

  line();
  line(`Sin verificar: ${input.unverified.duelists} de ${input.duelists.length} duelistas, ${input.unverified.cards} listas de cartas, ${input.unverified.summons} invocaciones.`);
  if (input.withoutSpanish.length > 0) {
    line();
    line(`Cartas sin clave "es" en YGOResources (${input.withoutSpanish.length}; quedan fuera del modo Texto y se ven con su nombre en inglés):`);
    for (const name of input.withoutSpanish) line(`  ${name}`);
  }
  line();
  line(`Respaldo en Yugipedia: todas las cartas aparecen en las páginas de su duelista; ${input.weakEvidence} solo mencionadas (no en una lista de deck).`);

  line();
  line('Pools mínimos con todas las series (10 en todos los modos):');
  const verifiedPool = (kind: string) => new Set(of(kind).map((content) => content.entityId)).size;
  line(`  Duelista (Clásico)   ${pad(input.duelists.length, 4)}`);
  line(`  Carta (Clásico)      ${pad(input.cards.length, 4)}`);
  line(`  Texto                ${pad(verifiedPool('card-text'), 4)} cartas con texto`);
  line(`  Arte / Zoom          ${pad(input.cards.length, 4)} cartas con ilustración`);
  line(`  Silueta              ${pad(input.silhouettes.usable, 4)} monstruos con recorte`);
  line(`  Carta insignia       ${pad(verifiedPool('ace-card'), 4)} duelistas con su carta as`);
  line(`  Deck                 ${pad(verifiedPool('deck'), 4)} duelistas`);
  line(`  Invocación           ${pad(verifiedPool('summon'), 4)} monstruos (de ${input.summonCandidates} fusión/sincro/xyz/ritual del pool)`);

  line();
  line('Imágenes (WebP):');
  line(`  Duelistas: ${input.images.fromYugipedia} de Yugipedia, ${input.images.manual} cargadas a mano, ${input.images.missing} sin imagen.`);
  const total =
    printImages(line, 'duelistas   ', input.rendered.duelists) +
    printImages(line, 'ilustración ', input.rendered.art) +
    printImages(line, 'carta as    ', input.rendered.faces) +
    printImages(line, 'silueta     ', input.rendered.silhouettes);
  line(`  Peso generado en esta corrida: ${mb(total)}`);
  line(`  Peso de public/img/yugioh: ${mb(input.imageBytesYugioh)}`);
  const limit = 200 * 1024 * 1024;
  line(
    `  Peso de public/img en total: ${mb(input.imageBytesProject)} de 200 MB (${input.imageBytesProject > limit ? 'SUPERA el límite de la SPEC: avisar antes de seguir' : `quedan ${mb(limit - input.imageBytesProject)}`}).`,
  );
  line();
}
