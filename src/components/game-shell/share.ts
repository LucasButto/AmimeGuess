// Texto para compartir el resultado. Lógica pura, sin React.
//
// Nada acá recibe la respuesta del reto: el texto se arma solo con el nombre
// del juego, el modo, las series, la cantidad de intentos, la grilla de emojis
// que aporta el motor (solo colores) y el link. Así no puede revelarla.

import { es } from '@/i18n/es';

/** La dirección de la página con el parámetro `s` de los filtros, sin ancla. */
export function buildShareUrl(href: string, filterKey: string): string {
  const url = new URL(href);
  url.searchParams.set('s', filterKey);
  url.hash = '';
  return url.toString();
}

/** "Gen 1", "Gen 1 y Gen 2", "Gen 1, Gen 2 y Gen 5". */
export function joinWords(words: readonly string[]): string {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} ${es.share.and} ${words[words.length - 1]}`;
}

/** La combinación de filtros en palabras: "todas" o los nombres de las series activas, en orden canónico. */
export function describeFilters(
  active: readonly string[],
  canonical: readonly string[],
  labels: Readonly<Record<string, string>>,
): string {
  if (canonical.every((id) => active.includes(id))) return es.share.allSeries;
  return joinWords(canonical.filter((id) => active.includes(id)).map((id) => labels[id] ?? id));
}

/** Líneas de la grilla que se comparten como máximo: una partida larga no tiene que ocupar la pantalla entera. */
export const MAX_GRID_LINES = 12;

/** Se queda con las últimas líneas (las más recientes, incluida la que acertó) y marca que faltan las primeras. */
export function limitGrid(grid: readonly string[]): string[] {
  if (grid.length <= MAX_GRID_LINES) return [...grid];
  return [es.share.omitted, ...grid.slice(-MAX_GRID_LINES)];
}

export interface ShareInput {
  franchiseName: string;
  modeName: string;
  /** Combinación de filtros en palabras, ver `describeFilters`. */
  filters: string;
  won: boolean;
  attempts: number;
  /** Solo en modos de puntaje: los aciertos seguidos. Reemplaza a la línea de intentos. */
  score?: number;
  /** Una línea de emojis por intento, sin nombres ni datos de la respuesta. */
  grid: readonly string[];
  url: string;
}

export function buildShareText({ franchiseName, modeName, filters, won, attempts, score, grid, url }: ShareInput): string {
  const outcome = score !== undefined ? es.share.score(score) : won ? es.share.won(attempts) : es.share.lost;
  const lines = [es.share.header(franchiseName, modeName), es.share.filters(filters), outcome];
  const shownGrid = limitGrid(grid);
  if (shownGrid.length > 0) lines.push('', ...shownGrid);
  lines.push('', url);
  return lines.join('\n');
}
