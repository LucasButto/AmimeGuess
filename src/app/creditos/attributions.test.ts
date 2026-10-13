import { describe, expect, it } from 'vitest';
import type { Content } from '@/engine/types';
import { franchises } from '@/franchises';
import { loadFranchiseData } from '@/franchises/data';
import { themeFonts } from '@/franchises/theme';
import { es } from '@/i18n/es';
import { attributionsOf, wikiPageTitle } from './attributions';

function content(id: string, source?: string): Content {
  return { id, kind: 'quote', series: 's1', payload: source === undefined ? { text: id } : { text: id, source }, verified: true };
}

describe('wikiPageTitle', () => {
  it('decodifica el último tramo y cambia los guiones bajos por espacios', () => {
    expect(wikiPageTitle('https://dragonball.fandom.com/es/wiki/Androide_N%C3%BAmero_17')).toBe('Androide Número 17');
    expect(wikiPageTitle('https://www.wikidex.net/wiki/Gran_Colmillo')).toBe('Gran Colmillo');
  });
});

describe('attributionsOf', () => {
  it('agrupa por sitio y por página, en el orden de los datos, y saltea lo que no tiene origen', () => {
    const sites = attributionsOf([
      content('a', 'https://naruto.fandom.com/wiki/Kakashi_Hatake'),
      content('b'),
      content('c', 'https://www.wikidex.net/wiki/Wyrdeer'),
      content('d', 'https://naruto.fandom.com/wiki/Kakashi_Hatake'),
      content('e', 'https://naruto.fandom.com/wiki/Gaara'),
    ]);
    expect(sites).toEqual([
      {
        host: 'naruto.fandom.com',
        count: 3,
        pages: [
          { url: 'https://naruto.fandom.com/wiki/Kakashi_Hatake', title: 'Kakashi Hatake', count: 2 },
          { url: 'https://naruto.fandom.com/wiki/Gaara', title: 'Gaara', count: 1 },
        ],
      },
      { host: 'www.wikidex.net', count: 1, pages: [{ url: 'https://www.wikidex.net/wiki/Wyrdeer', title: 'Wyrdeer', count: 1 }] },
    ]);
  });
});

describe('créditos sobre los datos reales', () => {
  it('todo texto con página de origen está atribuido, y cada sitio tiene nombre en es.ts', async () => {
    const all = await Promise.all(franchises.map((franchise) => loadFranchiseData(franchise.slug)));
    const contents = all.flatMap((data) => data?.contents ?? []);
    const sites = attributionsOf(contents);
    const withSource = contents.filter((item) => typeof item.payload.source === 'string');
    expect(sites.reduce((sum, site) => sum + site.count, 0)).toBe(withSource.length);
    for (const site of sites) expect(es.credits.reuse.sites[site.host], site.host).toBeDefined();
    // Las 127 descripciones de WikiDex, y las frases publicadas de Dragon Ball y Naruto.
    expect(sites.find((site) => site.host === 'www.wikidex.net')?.count).toBe(127);
    expect(sites.map((site) => site.host).sort()).toEqual(['dragonball.fandom.com', 'naruto.fandom.com', 'www.wikidex.net']);
  });

  it('cada tipografía de un tema está acreditada', () => {
    for (const franchise of franchises) {
      for (const id of themeFonts(franchise.theme)) expect(es.credits.fonts.items[id]).toBeDefined();
    }
  });
});
