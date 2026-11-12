import quotes from '../../../data/dragon-ball/source/frase.json';
import events from '../../../data/dragon-ball/source/events.json';
import sagas from '../../../data/dragon-ball/source/sagas.json';
import type { Content } from '@/engine/types';
import { es } from '@/i18n/es';
import { eventContents, quoteContent } from '../curated-content';
import { quotesSrcSchema } from '../../../scripts/data/dragon-ball/schemas';

export function dragonBallContents(generated: readonly Content[]): Content[] {
  return [
    ...quotesSrcSchema.parse(quotes).map((quote) => quoteContent(quote, {
      source: quote.source,
      addressee: quote.addressee ?? es.textClue.unknownAddressee,
      literal: quote.literal,
      famous: quote.famous,
    })),
    ...eventContents(events, sagas.seriesOrder),
    ...generated,
  ];
}
