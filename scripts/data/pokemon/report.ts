// Informe de consola al terminar el build.

import type { Content, Entity } from '../../../src/engine/types.ts';
import { CARDS_PER_POKEMON } from './cards.ts';
import type { Rendered, Size } from './images.ts';
import type { SignatureResult } from './moves.ts';

const pct = (part: number, total: number) => (total === 0 ? '  -  ' : `${((100 * part) / total).toFixed(0).padStart(3)}%`);
const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

export interface ReportInput {
  entities: Entity[];
  /** Todos los contenidos: descripciones (`dex`) y cartas (`tcg-card`). */
  contents: Content[];
  /** Cantidad de especies que informa la API, para contrastar. */
  apiSpeciesCount: number;
  /** Especies que no traen nombre en español y usan el inglés. */
  missingSpanishName: string[];
  rendered: Rendered[];
  /** Imágenes de las cartas del TCG. */
  cardImages: Rendered[];
  /** Pokémon para los que no se encontró ninguna carta. */
  withoutCard: string[];
  /** Movimientos insignia. */
  signature: SignatureResult;
}

/** Una línea por tamaño con cantidad, peso, promedio, máximo y calidades usadas; devuelve el peso total. */
function printImages(line: (text?: string) => void, images: Rendered[]): number {
  let total = 0;
  for (const size of [256, 512] as Size[]) {
    const group = images.filter((image) => image.size === size);
    if (group.length === 0) continue;
    const sum = group.reduce((acc, image) => acc + image.bytes, 0);
    total += sum;
    const largest = group.reduce((best, image) => (image.bytes > best.bytes ? image : best));
    const qualities = new Map<number, number>();
    for (const image of group) qualities.set(image.quality, (qualities.get(image.quality) ?? 0) + 1);
    const qualityText = [...qualities].sort((a, b) => b[0] - a[0]).map(([quality, count]) => `q${quality}×${count}`).join(' ');
    line(
      `  ${String(size).padStart(3)} px: ${String(group.length).padStart(4)} archivos, ${mb(sum).padStart(8)}, ` +
        `promedio ${kb(sum / group.length)}, máximo ${kb(largest.bytes)} (${largest.id}); ${qualityText}`,
    );
  }
  line(`  Peso total: ${mb(total)} (${images.length} archivos)`);
  return total;
}

export function printReport({
  entities,
  contents,
  apiSpeciesCount,
  missingSpanishName,
  rendered,
  cardImages,
  withoutCard,
  signature,
}: ReportInput): void {
  const line = (text = '') => console.log(text);
  const dexContents = contents.filter((content) => content.kind === 'dex');
  const cardContents = contents.filter((content) => content.kind === 'tcg-card');
  const contentByEntity = new Set(dexContents.map((content) => content.entityId));
  const generations = [...new Set(entities.map((entity) => entity.series[0]))].sort();

  line();
  line('=== Informe: datos de Pokémon ===');
  line(`Especies: ${entities.length} (la API informa ${apiSpeciesCount})`);
  line();
  line('Por generación                 entidades   con hábitat    con descripción (es)');
  for (const series of generations) {
    const group = entities.filter((entity) => entity.series[0] === series);
    const withHabitat = group.filter((entity) => entity.attrs.habitat !== null).length;
    const withDex = group.filter((entity) => contentByEntity.has(entity.id)).length;
    line(
      `  ${series.padEnd(26)}${String(group.length).padStart(9)}   ` +
        `${`${withHabitat}/${group.length}`.padStart(9)} ${pct(withHabitat, group.length)}   ` +
        `${`${withDex}/${group.length}`.padStart(9)} ${pct(withDex, group.length)}`,
    );
  }
  const habitatTotal = entities.filter((entity) => entity.attrs.habitat !== null).length;
  line(
    `  ${'TOTAL'.padEnd(26)}${String(entities.length).padStart(9)}   ` +
      `${`${habitatTotal}/${entities.length}`.padStart(9)} ${pct(habitatTotal, entities.length)}   ` +
      `${`${dexContents.length}/${entities.length}`.padStart(9)} ${pct(dexContents.length, entities.length)}`,
  );

  const groupsWithoutEggs = entities.filter((entity) => (entity.attrs.gruposHuevo as string[]).length === 0).length;
  line();
  line(`Grupos huevo: ${entities.length - groupsWithoutEggs}/${entities.length} especies con al menos un grupo.`);

  const masked = dexContents.filter((content) => String(content.payload.text).includes('???')).length;
  line(`Descripciones: ${dexContents.length} en español; el nombre se enmascaró en ${masked}.`);
  if (missingSpanishName.length > 0) {
    line(`Nombres sin traducción al español (se usa el inglés): ${missingSpanishName.length}`);
    line(`  ${missingSpanishName.join(', ')}`);
  }

  line();
  line('Imágenes (WebP):');
  const artworkTotal = printImages(line, rendered);

  line();
  line(`Cartas del TCG (TCGdex, hasta ${CARDS_PER_POKEMON} por Pokémon):`);
  line('Por generación                 Pokémon     con carta    cartas');
  for (const series of generations) {
    const group = entities.filter((entity) => entity.series[0] === series);
    const cards = cardContents.filter((content) => content.series === series);
    const withCard = group.filter((entity) => cards.some((content) => content.entityId === entity.id)).length;
    line(
      `  ${series.padEnd(26)}${String(group.length).padStart(9)}   ` +
        `${`${withCard}/${group.length}`.padStart(9)} ${pct(withCard, group.length)}   ${String(cards.length).padStart(6)}`,
    );
  }
  const withOne = entities.filter((entity) => cardContents.filter((content) => content.entityId === entity.id).length === 1).length;
  line(`  Total: ${cardContents.length} cartas; ${withOne} Pokémon con una sola.`);
  line(`  Pokémon sin carta: ${withoutCard.length}${withoutCard.length > 0 ? ` (${withoutCard.join(', ')})` : ''}`);
  const cardTotal = printImages(line, cardImages);

  line();
  const signatureContents = contents.filter((content) => content.kind === 'signature-move');
  line(`Movimientos insignia (los que solo aprende una línea evolutiva): ${signature.moves} movimientos, ${signatureContents.length} contenidos.`);
  line('Por generación                 Pokémon     con movimiento    contenidos');
  for (const series of generations) {
    const group = entities.filter((entity) => entity.series[0] === series);
    const own = signatureContents.filter((content) => content.series === series);
    const withMove = group.filter((entity) => own.some((content) => content.entityId === entity.id)).length;
    line(
      `  ${series.padEnd(26)}${String(group.length).padStart(9)}   ` +
        `${`${withMove}/${group.length}`.padStart(11)} ${pct(withMove, group.length)}   ${String(own.length).padStart(7)}`,
    );
  }
  const withMoveTotal = new Set(signatureContents.map((content) => content.entityId)).size;
  line(`  Total: ${withMoveTotal} Pokémon con al menos un movimiento insignia.`);
  const shared = signatureContents.filter((content) => (content.payload.accepts as string[]).length > 0).length;
  line(`  ${shared} contenidos son de movimientos que aprenden varias especies de la línea (las demás también cuentan como respuesta).`);
  line(`  ${signature.withoutText} movimientos sin texto en español (se juegan solo con nombre y tipo).`);
  if (signature.excluded.length > 0) {
    line(`  Excluidos (${signature.excluded.length}):`);
    for (const item of signature.excluded) line(`    - ${item.move}: ${item.reason}`);
  }

  line();
  line(`Peso de public/img/pokemon: ${mb(artworkTotal + cardTotal)} (arte oficial ${mb(artworkTotal)} + cartas ${mb(cardTotal)}).`);
  line();
}
