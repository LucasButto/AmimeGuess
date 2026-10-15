import { describe, expect, it } from 'vitest';
import type { Content, Entity } from '@/engine/types';
import { withoutFlagged, type FranchiseData } from './data';

const entity = (id: string, attrs: Entity['attrs'] = {}): Entity => ({ id, name: { es: id }, aliases: [], series: ['s1'], attrs });
const content = (id: string, payload: Content['payload']): Content => ({ id, kind: 'event', series: 's1', payload, verified: true });

const data: FranchiseData = {
  entities: [entity('a'), entity('pelicula', { filler: 1 }), entity('manga', { mangaOnly: 1 })],
  contents: [content('e1', { text: 'x' }), content('e2', { text: 'y', filler: true }), content('e3', { text: 'z', mangaOnly: true })],
  entitySets: { forms: [entity('f1'), entity('f2', { mangaOnly: 1 })] },
};
const ids = (list: readonly { id: string }[]) => list.map((item) => item.id);

describe('withoutFlagged', () => {
  it('sin nada que dejar afuera, devuelve los mismos datos', () => {
    expect(withoutFlagged(data, { skipFiller: false, skipMangaOnly: false })).toBe(data);
  });

  it('sin relleno: saca las entidades y los contenidos con esa marca', () => {
    const result = withoutFlagged(data, { skipFiller: true, skipMangaOnly: false });
    expect(ids(result.entities)).toEqual(['a', 'manga']);
    expect(ids(result.contents)).toEqual(['e1', 'e3']);
    expect(ids(result.entitySets?.forms ?? [])).toEqual(['f1', 'f2']);
  });

  it('solo anime: saca lo que solo está en el manga, también de los conjuntos', () => {
    const result = withoutFlagged(data, { skipFiller: false, skipMangaOnly: true });
    expect(ids(result.entities)).toEqual(['a', 'pelicula']);
    expect(ids(result.contents)).toEqual(['e1', 'e2']);
    expect(ids(result.entitySets?.forms ?? [])).toEqual(['f1']);
  });
});
