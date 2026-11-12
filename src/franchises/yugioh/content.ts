import events from '../../../data/yugioh/source/events.json';
import seriesJson from '../../../data/yugioh/series.json';
import type { Content } from '@/engine/types';
import { eventContents } from '../curated-content';

export function yugiohContents(generated: readonly Content[]): Content[] {
  const series = seriesJson.series.map(({ id }) => id);
  return [...generated, ...eventContents(events, series)].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
