import { es } from '@/i18n/es';
import type { Stats } from '@/engine/storage';

export interface DistributionRow {
  label: string;
  /** Cantidad de intentos que representa la fila; `null` en la última si agrupa "13+". */
  attempts: number | null;
  count: number;
  /** Intentos con los que se ganó, para resaltar la última partida. */
  rangeStart: number;
}

/** Filas del gráfico: 1, 2, 3… hasta el mayor valor (con tope) y, si hay más, una final que los agrupa ("13+"). */
export function distributionRows(distribution: Readonly<Record<string, number>>, maxRows = 12): DistributionRow[] {
  const entries = Object.entries(distribution)
    .map(([attempts, count]) => ({ attempts: Number(attempts), count }))
    .filter((entry) => Number.isInteger(entry.attempts) && entry.attempts >= 1 && entry.count > 0);
  if (entries.length === 0) return [];

  const largest = Math.max(...entries.map((entry) => entry.attempts));
  const rows: DistributionRow[] = [];
  for (let attempts = 1; attempts <= Math.min(largest, maxRows); attempts++) {
    const count = entries.filter((entry) => entry.attempts === attempts).reduce((sum, entry) => sum + entry.count, 0);
    rows.push({ label: String(attempts), attempts, count, rangeStart: attempts });
  }
  const overflow = entries.filter((entry) => entry.attempts > maxRows).reduce((sum, entry) => sum + entry.count, 0);
  if (overflow > 0) {
    rows.push({ label: es.shell.statsView.moreThan(maxRows + 1), attempts: null, count: overflow, rangeStart: maxRows + 1 });
  }
  return rows;
}

/** ¿La fila contiene una partida ganada con esa cantidad de intentos? */
export function rowHolds(row: DistributionRow, attempts: number): boolean {
  return row.attempts === null ? attempts >= row.rangeStart : row.attempts === attempts;
}

/** Porcentaje de victorias, entero de 0 a 100. Sin partidas, 0. */
export function winRate(stats: Pick<Stats, 'played' | 'won'>): number {
  return stats.played === 0 ? 0 : Math.round((100 * stats.won) / stats.played);
}
