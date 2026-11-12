import type { Content } from '../engine/types';

interface CuratedRow {
  id: string;
  series: string;
  text: string;
  verified: boolean;
}

export function quoteContent(
  quote: CuratedRow & { character: string },
  details: Record<string, unknown>,
): Content {
  return {
    id: `quote-${quote.id}`,
    kind: 'quote',
    entityId: quote.character,
    series: quote.series,
    payload: { text: quote.text, ...details },
    verified: quote.verified,
  };
}

export function eventContents(
  events: readonly (CuratedRow & { order: number; filler?: boolean; mangaOnly?: boolean })[],
  series: readonly string[] = [],
): Content[] {
  const sorted = [...events].sort((a, b) => series.indexOf(a.series) - series.indexOf(b.series) || a.order - b.order);
  const orders = new Map(sorted.map(({ id }, index) => [id, index + 1]));
  return events.map(({ id, series, text, verified, filler, mangaOnly }) => ({
    id: `event-${id}`,
    kind: 'event',
    series,
    verified,
    payload: {
      text,
      order: orders.get(id),
      ...(filler ? { filler: true } : {}),
      ...(mangaOnly ? { mangaOnly: true } : {}),
    },
  }));
}
