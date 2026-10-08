// Informe de consola al terminar el build de Naruto.

import type { Content, Entity } from '../../../src/engine/types.ts';
import type { Rendered } from '../dragon-ball/images.ts';
import { SERIES, type SeriesId } from './schemas.ts';

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
const pad = (value: string | number, width: number) => String(value).padStart(width);

export interface UnverifiedCount {
  readonly label: string;
  readonly unverified: number;
  readonly total: number;
}

export interface ReportInput {
  readonly characters: Entity[];
  readonly contents: Content[];
  readonly arcCount: number;
  readonly rendered: { characters: Rendered[]; jutsus: Rendered[] };
  readonly unverified: UnverifiedCount[];
  /** Personajes y jutsus sin imagen (a cargar a mano). */
  readonly missing: { characters: number; jutsus: number };
  /** Imágenes cargadas que no son de fondo transparente: no sirven para Silueta. */
  readonly opaqueImages: string[];
  readonly jutsusTotal: number;
  /** Personajes distintos que son respuesta de algún jutsu con imagen: lo que cuenta el pool del modo Jutsu. */
  readonly jutsuAnswers: number;
  readonly boards: { all: number; bySeries: Record<SeriesId, number> };
  readonly groupCount: number;
  readonly sharedMembers: number;
  readonly jutsuTypeStats: { jutsuTotal: number; resolved: number };
  /** Cuántos jutsu de los curados se aceptaron además de la respuesta (más de uno = la imagen vale para varios). */
  readonly acceptedExtras: number;
  readonly teamHints: string[];
  readonly imageBytesNaruto: number;
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

function countBySeries(items: ReadonlyArray<{ series: readonly string[] }>, series: SeriesId): number {
  return items.filter((item) => item.series.includes(series)).length;
}

export function printReport(input: ReportInput): void {
  const line = (text = '') => console.log(text);
  const { characters, contents } = input;
  const of = (kind: string) => contents.filter((content) => content.kind === kind);
  const quotes = of('quote');
  const jutsus = of('jutsu');
  const teams = of('team');
  const emojis = of('emoji');
  const groups = of('group');
  const transparent = (entity: Entity) => entity.attrs.imagenTransparente === 1;
  const withImage = (entity: Entity) => entity.image !== undefined;

  line();
  line('=== Informe: datos de Naruto ===');
  line(`Series: ${SERIES.join(' → ')}  (${input.arcCount} arcos)`);
  line();
  line('Por serie                      personajes   debutan   frases   jutsus   equipos   emojis   grupos');
  for (const series of SERIES) {
    const debut = characters.filter((entity) => entity.series[0] === series).length;
    line(
      `  ${series.padEnd(26)}${pad(countBySeries(characters, series), 10)}${pad(debut, 10)}${pad(quotes.filter((c) => c.series === series).length, 9)}` +
        `${pad(jutsus.filter((c) => c.series === series).length, 9)}${pad(teams.filter((c) => c.series === series).length, 10)}` +
        `${pad(emojis.filter((c) => c.series === series).length, 9)}${pad(groups.filter((c) => c.series === series).length, 9)}`,
    );
  }
  line(
    `  ${'TOTAL'.padEnd(26)}${pad(characters.length, 10)}${pad(characters.length, 10)}${pad(quotes.length, 9)}${pad(jutsus.length, 9)}${pad(teams.length, 10)}${pad(emojis.length, 9)}${pad(groups.length, 9)}`,
  );
  line('  ("personajes" cuenta las series en las que aparece cada uno; "debutan", solo la de debut)');

  line();
  line('Sin verificar (verified: false), a revisar en data-src/naruto/:');
  for (const item of input.unverified) line(`  ${item.label.padEnd(16)}${pad(item.unverified, 4)} de ${pad(item.total, 4)}`);
  line('  Solo las frases esperan verified: true para entrar al pool de producción.');
  line('  Las traducciones de translations.json también están sin verificar, pero se usan: sin ellas el Clásico no tendría atributos.');

  line();
  line('Tamaño del pool de cada modo con todas las series activas:');
  line(`  Clásico (personajes)            ${pad(characters.length, 4)}`);
  line(`  Silueta (arte transparente)     ${pad(characters.filter(transparent).length, 4)}   (hacen falta 10; hay ${characters.filter(withImage).length} personajes con imagen)`);
  line(`  Borroso y Zoom (con imagen)     ${pad(characters.filter(withImage).length, 4)}`);
  line(`  Ojo (imagen + punto focal)      ${pad(of('eye').length, 4)}   (hacen falta 10)`);
  const verifiedQuotes = quotes.filter((c) => c.verified);
  line(`  Frase (personajes distintos)    ${pad(new Set(verifiedQuotes.map((c) => c.entityId)).size, 4)}   (hacen falta 10; ${verifiedQuotes.length} de ${quotes.length} frases verificadas)`);
  line(`  Jutsu (personajes distintos)    ${pad(input.jutsuAnswers, 4)}   (hacen falta 10; ${jutsus.length} de ${input.jutsusTotal} jutsus con imagen)`);
  line(`  Equipo (personajes distintos)   ${pad(new Set(teams.map((c) => c.entityId)).size, 4)}   (${teams.length} contenidos de ${new Set(teams.map((c) => c.payload.team)).size} equipos)`);
  line(`  Emoji (personajes distintos)    ${pad(new Set(emojis.map((c) => c.entityId)).size, 4)}   (${of('emoji-arc').length} arcos con emojis, sin modo que los use todavía)`);
  line(`  Conexiones (tableros)           ${pad(input.boards.all, 4)}   (hacen falta 30; ${input.groupCount} grupos, ${input.sharedMembers} personajes en más de un grupo)`);

  line();
  line('Tableros de Conexiones posibles (un grupo de cada dificultad, sin personajes compartidos entre los elegidos):');
  line(`  todas las series ${pad(input.boards.all, 6)}   ${SERIES.map((series) => `solo ${series} ${input.boards.bySeries[series]}`).join('   ')}`);

  line();
  line('Clásico con una sola serie activa (pool mínimo: 20):');
  for (const series of SERIES) {
    const count = countBySeries(characters, series);
    line(`  solo ${series.padEnd(10)}${pad(count, 4)} personajes${count < 20 ? '   ← por debajo del mínimo' : ''}`);
  }

  line();
  line(`Tipos de jutsu: ${input.jutsuTypeStats.resolved} de ${input.jutsuTypeStats.jutsuTotal} jutsus de los personajes se resolvieron en Narutopedia.`);
  line(`Jutsus curados: ${input.acceptedExtras} respuestas extra aceptadas (otros usuarios del jutsu que figuran en la infobox).`);
  if (input.teamHints.length > 0) {
    line();
    line('Equipos: personajes del juego que Dattebayo pone en el equipo y el equipo curado no (para revisar, no es un error):');
    for (const hint of input.teamHints) line(`  ${hint}`);
  }

  line();
  line('Imágenes (WebP):');
  const total = printImages(line, 'personajes  ', input.rendered.characters) + printImages(line, 'jutsus      ', input.rendered.jutsus);
  line(`  Peso generado en esta corrida: ${mb(total)}`);
  line(`  Peso de public/img/naruto: ${mb(input.imageBytesNaruto)}`);
  const limit = 150 * 1024 * 1024;
  line(
    `  Peso de public/img en total: ${mb(input.imageBytesProject)} de 150 MB (${input.imageBytesProject > limit ? 'SUPERA el límite de la SPEC: avisar antes de seguir' : `quedan ${mb(limit - input.imageBytesProject)}`}).`,
  );
  line(`  Personajes sin imagen: ${input.missing.characters} de ${characters.length}; jutsus sin imagen: ${input.missing.jutsus} de ${input.jutsusTotal}  → ver docs/CONTENT_TODO.md`);
  line(
    `  Imágenes con fondo (no sirven para Silueta): ${input.opaqueImages.length}${input.opaqueImages.length > 0 ? ` (${input.opaqueImages.join(', ')})` : '  (todavía no hay imágenes cargadas, así que no se puede contar cuántas necesitarían quitarles el fondo)'}`,
  );
  line();
}
