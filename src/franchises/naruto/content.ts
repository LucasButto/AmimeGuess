import quotes from '../../../data/naruto/source/frase.json';
import events from '../../../data/naruto/source/events.json';
import arcs from '../../../data/naruto/source/arcs.json';
import characters from '../../../data/naruto/source/characters.json';
import { plainDisplayText } from '../../../scripts/data/naruto/display-text';
import type { Content } from '@/engine/types';
import { eventContents, quoteContent } from '../curated-content';

export function narutoContents(generated: readonly Content[]): Content[] {
  const arcNames = new Map(arcs.map(({ id, name }) => [id, name]));
  const wikiTitles = new Map(characters.map(({ id, wiki, apiName }: { id: string; wiki?: string; apiName: string }) => [id, wiki ?? apiName]));
  const quoteRows = plainDisplayText(quotes.map((quote: (typeof quotes)[number] & { source?: string }) => {
    const wikiTitle = wikiTitles.get(quote.character);
    const source = quote.source ?? (wikiTitle && `https://naruto.fandom.com/wiki/${encodeURIComponent(wikiTitle.replace(/ /g, '_'))}`);
    return quoteContent(quote, {
      source,
      ...(quote.addressee == null ? {} : { addressee: quote.addressee }),
      arc: arcNames.get(quote.arc),
      ...(quote.accepts?.length ? { accepts: quote.accepts } : {}),
    });
  }));
  // Se conserva el orden del catálogo anterior, incluso para los modos que leen la primera pista disponible.
  const beforeEvents = generated.findIndex(({ kind }) => kind !== 'team' && kind !== 'emoji' && kind !== 'emoji-arc');
  const index = beforeEvents === -1 ? generated.length : beforeEvents;
  return [...quoteRows, ...generated.slice(0, index), ...plainDisplayText(eventContents(events)), ...generated.slice(index)];
}
