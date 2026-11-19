// Informe de consola al terminar el build de Dragon Ball.

import type { Content, Entity } from '../../../src/engine/types.ts';
import type { Rendered } from './images.ts';
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
  readonly seriesOrder: readonly SeriesId[];
  readonly characters: Entity[];
  readonly contents: Content[];
  readonly sagaCount: number;
  readonly rendered: { characters: Rendered[]; techniques: Rendered[] };
  /** Los clips del modo Técnica: peso del video y del póster, y de dónde salió. */
  readonly clips: ReadonlyArray<{ id: string; clipBytes: number; posterBytes: number; source: string; crf: number | 'copia'; cropped: boolean; cleaned: boolean; seconds: number }>;
  readonly unverified: UnverifiedCount[];
  /** Personajes sin imagen y técnicas sin imagen (a cargar a mano). */
  readonly missing: { characters: string[]; techniques: string[] };
  /** Imágenes que no son de fondo transparente: no sirven para Silueta. */
  readonly opaqueImages: string[];
  readonly techniquesTotal: number;
  /** Personajes distintos que son respuesta de alguna técnica con imagen: lo que cuenta el pool del modo Técnica. */
  readonly techniqueAnswers: number;
  /** Personajes distintos que son respuesta de alguna técnica (el buscador sigue ofreciendo a todos los de las series activas). */
  readonly techniqueCharacters: number;
  readonly connectionGroups: number;
  readonly connectionBoards: number;
  readonly imageBytesDragonBall: number;
  readonly imageBytesProject: number;
}

/** Una línea por tamaño con cantidad, peso, promedio y máximo; devuelve el peso total. */
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
  const quotes = contents.filter((content) => content.kind === 'quote');
  const events = contents.filter((content) => content.kind === 'event');
  const techniques = contents.filter((content) => content.kind === 'technique');
  const transparent = (entity: Entity) => entity.attrs.imagenTransparente === 1;
  const withImage = (entity: Entity) => entity.image !== undefined;

  line();
  line('=== Informe: datos de Dragon Ball ===');
  line(`Cronología de las series: ${input.seriesOrder.join(' → ')}  (${input.sagaCount} sagas)`);
  line();
  line('Por serie                      personajes   debutan   frases   sucesos   técnicas');
  for (const series of SERIES) {
    const debut = characters.filter((entity) => entity.series[0] === series).length;
    line(
      `  ${series.padEnd(26)}${pad(countBySeries(characters, series), 10)}${pad(debut, 10)}` +
        `${pad(quotes.filter((c) => c.series === series).length, 9)}${pad(events.filter((c) => c.series === series).length, 10)}` +
        `${pad(techniques.filter((c) => c.series === series).length, 11)}`,
    );
  }
  line(
    `  ${'TOTAL'.padEnd(26)}${pad(characters.length, 10)}${pad(characters.length, 10)}${pad(quotes.length, 9)}${pad(events.length, 10)}${pad(techniques.length, 11)}`,
  );
  line('  ("personajes" cuenta las series en las que aparece cada uno; "debutan", solo la de debut)');

  line();
  line('Sin verificar (verified: false), a revisar en data/dragon-ball/source/:');
  for (const item of input.unverified) line(`  ${item.label.padEnd(16)}${pad(item.unverified, 4)} de ${pad(item.total, 4)}`);
  line('  Solo las frases y los sucesos de la línea de tiempo esperan verified: true para entrar al pool de producción.');

  line();
  line('Tamaño del pool de cada modo con todas las series activas:');
  line(`  Clásico (personajes)            ${pad(characters.length, 4)}`);
  line(`  Silueta (arte transparente)     ${pad(characters.filter(transparent).length, 4)}`);
  line(`  Personajes con imagen           ${pad(characters.filter(withImage).length, 4)}`);
  // El pool de Frase cuenta personajes distintos que dijeron alguna frase verificada, no frases.
  const verifiedQuotes = quotes.filter((c) => c.verified);
  line(`  Frase (personajes distintos)    ${pad(new Set(verifiedQuotes.map((c) => c.entityId)).size, 4)}   (hacen falta 10; ${verifiedQuotes.length} de ${quotes.length} frases verificadas)`);
  line(`  Técnica (técnicas)              ${pad(input.techniqueAnswers, 4)}   (hacen falta 10; ${input.techniqueAnswers} de ${input.techniquesTotal} con clip o imagen; ${input.techniqueCharacters} personajes distintos)`);
  line(`  Conexiones (grupos)             ${pad(input.connectionGroups, 4)}   (${input.connectionBoards} tableros distintos con todas las series)`);
  line(`  Línea de tiempo (verificados)   ${pad(events.filter((c) => c.verified).length, 4)}   (hacen falta 10; hay ${events.length} sucesos)`);

  line();
  line('Clásico con una sola serie activa (pool mínimo: 10):');
  for (const series of SERIES) {
    const count = countBySeries(characters, series);
    line(`  solo ${series.padEnd(6)}${pad(count, 4)} personajes${count < 20 ? '   ← por debajo del mínimo' : ''}`);
  }

  line();
  line('Imágenes (WebP):');
  const total =
    printImages(line, 'personajes  ', input.rendered.characters) +
    printImages(line, 'técnicas    ', input.rendered.techniques);
  line(`  Peso generado en esta corrida: ${mb(total)}`);
  printClips(line, input.clips);
  line(`  Peso de public/img/dragon-ball: ${mb(input.imageBytesDragonBall)}`);
  const limit = 250 * 1024 * 1024;
  line(
    `  Peso de public/img en total: ${mb(input.imageBytesProject)} de 250 MB (${input.imageBytesProject > limit ? 'SUPERA el límite de la SPEC: avisar antes de seguir' : `quedan ${mb(limit - input.imageBytesProject)}`}).`,
  );
  line(`  Personajes sin imagen: ${input.missing.characters.length}; técnicas sin imagen: ${input.missing.techniques.length}  → ver docs/CONTENT_TODO.md`);
  line(`  Imágenes con fondo (no sirven para Silueta): ${input.opaqueImages.length}${input.opaqueImages.length > 0 ? ` (${input.opaqueImages.join(', ')})` : ''}`);
  line();
}

/** Los clips del modo Técnica (public/video/dragon-ball/): cuántos son, cuánto pesan, de dónde salieron y el más pesado. */
function printClips(line: (text?: string) => void, clips: ReportInput['clips']): void {
  if (clips.length === 0) return;
  const bytes = clips.reduce((sum, clip) => sum + clip.clipBytes, 0);
  const heaviest = clips.reduce((max, clip) => (clip.clipBytes > max.clipBytes ? clip : max));
  const posters = clips.reduce((sum, clip) => sum + clip.posterBytes, 0);
  const seconds = clips.reduce((sum, clip) => sum + clip.seconds, 0);
  line(`  Clips (MP4 sin audio, public/video/dragon-ball): ${clips.length}, ${mb(bytes)} en total, promedio ${(bytes / clips.length / 1024).toFixed(0)} KB, máximo ${(heaviest.clipBytes / 1024).toFixed(0)} KB (${heaviest.id}); duran ${seconds.toFixed(0)} s en total; pósters: ${mb(posters)}`);
  const origins = new Map<string, number>();
  for (const clip of clips) origins.set(clip.source, (origins.get(clip.source) ?? 0) + 1);
  line(`  Orígenes: ${[...origins].map(([origin, count]) => `${count} de ${origin}`).join(', ')}; con recorte de subtítulos: ${clips.filter((clip) => clip.cropped).length}; con marca borrada: ${clips.filter((clip) => clip.cleaned).length}; copiados sin recomprimir: ${clips.filter((clip) => clip.crf === 'copia').length}`);
}
