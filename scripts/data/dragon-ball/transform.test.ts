import { describe, expect, it } from 'vitest';
import type { CharacterSrc, EventSrc, SagasFile, TransformationSrc } from './schemas.ts';
import {
  buildCharacterEntity,
  buildEventContent,
  buildTransformationEntity,
  canonicalSeries,
  debutSeries,
  eventOrders,
  leaksName,
  sagaRanks,
  seriesOfPage,
  seriesRanks,
} from './transform.ts';

const ORDER = ['db', 'dbz', 'daima', 'super', 'gt'] as const;

describe('seriesRanks', () => {
  it('numera las series desde 1 en el orden de la cronología', () => {
    const ranks = seriesRanks(ORDER);
    expect([...ranks]).toEqual([['db', 1], ['dbz', 2], ['daima', 3], ['super', 4], ['gt', 5]]);
  });

  it('rechaza un orden que repite o deja afuera una serie', () => {
    expect(() => seriesRanks(['db', 'dbz', 'daima', 'super', 'super'])).toThrow(/exactamente una vez/);
    expect(() => seriesRanks(['db', 'dbz', 'gt', 'super'])).toThrow();
  });
});

describe('sagaRanks', () => {
  const file: SagasFile = {
    seriesOrder: [...ORDER],
    sagas: [
      { id: 'gt-uno', series: 'gt', name: 'GT 1' },
      { id: 'db-uno', series: 'db', name: 'DB 1' },
      { id: 'super-uno', series: 'super', name: 'Super 1' },
      { id: 'db-dos', series: 'db', name: 'DB 2' },
      { id: 'dbz-uno', series: 'dbz', name: 'DBZ 1' },
    ],
  };

  it('ordena primero por serie y dentro de ella según el archivo', () => {
    const ranks = sagaRanks(file);
    expect([...ranks].sort((a, b) => a[1] - b[1]).map(([id]) => id)).toEqual(['db-uno', 'db-dos', 'dbz-uno', 'super-uno', 'gt-uno']);
    expect(Math.max(...ranks.values())).toBe(5);
  });

  it('cambiar el orden de las series reordena las sagas sin tocar su orden interno', () => {
    const release = sagaRanks({ ...file, seriesOrder: ['db', 'dbz', 'gt', 'super', 'daima'] });
    expect(release.get('gt-uno')).toBeLessThan(release.get('super-uno') as number);
    expect(release.get('db-uno')).toBeLessThan(release.get('db-dos') as number);
  });

  it('rechaza una saga repetida', () => {
    expect(() => sagaRanks({ ...file, sagas: [...file.sagas, { id: 'db-uno', series: 'db', name: 'otra' }] })).toThrow(/repetida/);
  });
});

describe('series de un personaje', () => {
  const members = {
    db: new Set(['Goku']),
    dbz: new Set(['Goku', 'Freeza']),
    gt: new Set(['Freeza']),
    super: new Set(['Goku', 'Freeza']),
    daima: new Set(['Goku']),
  };

  it('sale de las categorías de la wiki, en orden canónico', () => {
    expect(seriesOfPage('Goku', members)).toEqual(['db', 'dbz', 'super', 'daima']);
    expect(seriesOfPage('Freeza', members)).toEqual(['dbz', 'gt', 'super']);
    expect(seriesOfPage('Nadie', members)).toEqual([]);
  });

  it('canonicalSeries ordena y quita repetidos', () => {
    expect(canonicalSeries(['super', 'db', 'super', 'gt'])).toEqual(['db', 'gt', 'super']);
  });

  it('la serie de debut es la primera de emisión, no la primera de la cronología', () => {
    // Debutó en Super (2015) y también sale en Daima (2024), que en la historia ocurre antes que Super.
    expect(debutSeries(['daima', 'super'])).toBe('super');
    expect(debutSeries(['gt', 'dbz'])).toBe('dbz');
    expect(() => debutSeries([])).toThrow();
  });
});

describe('leaksName', () => {
  it('detecta el nombre ignorando tildes, mayúsculas y signos', () => {
    expect(leaksName('¡Yo soy el Supersaiyano SON GOKU!', ['Son Goku'])).toBe(true);
    expect(leaksName('Soy Célula, ¡el perfecto!', ['Celula'])).toBe(true);
  });

  it('solo cuenta palabras completas', () => {
    expect(leaksName('Un panadero muy amable', ['Pan'])).toBe(false);
    expect(leaksName('Mataste a Krilin', ['Goku'])).toBe(false);
  });

  it('ignora nombres de menos de 3 letras', () => {
    expect(leaksName('Es un 17 más', ['17'])).toBe(false);
  });
});

const character: CharacterSrc = {
  id: 'goku',
  name: 'Goku',
  aliases: ['Son Goku', 'goku', 'GOKU', 'Kakarotto'],
  api: 1,
  wiki: 'Son Goku',
  genero: 'Masculino',
  razas: ['Saiyano'],
  afiliaciones: ['Guerreros Z'],
  planeta: 'Planeta Vegeta',
  transformaciones: [{ value: 'Supersaiyano', series: 'dbz' }, { value: 'Supersaiyano 4', series: 'gt' }],
  sagaDebut: 'pilaf',
  estadoVital: 'Vivo',
  tecnica: 'Kamehameha',
  verified: false,
};

describe('buildCharacterEntity', () => {
  const base = { src: character, series: ['db', 'dbz'] as const, debutSeriesRank: 1, debutSagaRank: 1, power: undefined, image: null };

  it('arma los atributos del Clásico y deja null lo que no hay', () => {
    const entity = buildCharacterEntity(base);
    expect(entity.attrs).toEqual({
      genero: 'Masculino',
      razas: ['Saiyano'],
      afiliaciones: ['Guerreros Z'],
      planeta: 'Planeta Vegeta',
      transformaciones: [{ value: 'Supersaiyano', series: 'dbz' }, { value: 'Supersaiyano 4', series: 'gt' }],
      serieDebut: 1,
      sagaDebut: 1,
      estadoVital: 'Vivo',
      tecnica: 'Kamehameha',
      ki: null,
      kiOficial: null,
      imagenTransparente: null,
    });
    expect(entity.image).toBeUndefined();
  });

  it('quita los alias repetidos y el que es igual al nombre', () => {
    expect(buildCharacterEntity(base).aliases).toEqual(['Son Goku', 'Kakarotto']);
  });

  it('el ki y su marca de oficial salen de power.json; 1 es oficial y 0 no', () => {
    expect(buildCharacterEntity({ ...base, power: { id: 'goku', ki: 1500, official: true, source: 'x' } }).attrs).toMatchObject({ ki: 1500, kiOficial: 1 });
    expect(buildCharacterEntity({ ...base, power: { id: 'goku', ki: 9e25, official: false, source: 'x' } }).attrs).toMatchObject({ ki: 9e25, kiOficial: 0 });
    expect(buildCharacterEntity({ ...base, power: { id: 'goku', ki: null, official: false, source: 'x' } }).attrs).toMatchObject({ ki: null, kiOficial: null });
  });

  it('marca si la imagen es de fondo transparente (1) o no (0)', () => {
    const transparent = buildCharacterEntity({ ...base, image: { path: 'dragon-ball/goku', transparent: true } });
    expect(transparent.image).toBe('dragon-ball/goku');
    expect(transparent.attrs.imagenTransparente).toBe(1);
    expect(buildCharacterEntity({ ...base, image: { path: 'dragon-ball/goku', transparent: false } }).attrs.imagenTransparente).toBe(0);
  });

  it('no comparte las listas con la fuente: cambiar la entidad no cambia lo curado', () => {
    const entity = buildCharacterEntity(base);
    (entity.attrs.razas as string[]).push('Otra');
    expect(character.razas).toEqual(['Saiyano']);
  });
});

describe('buildTransformationEntity', () => {
  const form: TransformationSrc = {
    id: 'goku-ssj',
    api: 1,
    character: 'goku',
    forma: 'Supersaiyano',
    name: 'Goku Supersaiyano',
    aliases: ['Goku SSJ'],
    series: 'dbz',
    verified: false,
  };

  it('es una entidad de una sola serie con el personaje y la forma como atributos', () => {
    const entity = buildTransformationEntity(form, 'Goku', { path: 'dragon-ball/transformations/goku-ssj', transparent: true });
    expect(entity).toEqual({
      id: 'goku-ssj',
      name: { es: 'Goku Supersaiyano' },
      aliases: ['Goku SSJ'],
      series: ['dbz'],
      image: 'dragon-ball/transformations/goku-ssj',
      attrs: { personaje: 'Goku', forma: 'Supersaiyano', imagenTransparente: 1 },
    });
  });
});

describe('eventOrders', () => {
  const event = (id: string, series: EventSrc['series'], order: number): EventSrc => ({ id, text: id, series, order, verified: false });
  const events = [event('super-1', 'super', 1), event('db-2', 'db', 2), event('gt-1', 'gt', 1), event('db-1', 'db', 1), event('dbz-1', 'dbz', 1)];

  it('ordena por la cronología de las series y después por la posición dentro de la serie', () => {
    const orders = eventOrders(events, ORDER);
    expect([...orders].sort((a, b) => a[1] - b[1]).map(([id]) => id)).toEqual(['db-1', 'db-2', 'dbz-1', 'super-1', 'gt-1']);
  });

  it('con otro orden de series cambia el lugar de los sucesos', () => {
    const orders = eventOrders(events, ['db', 'dbz', 'gt', 'super', 'daima']);
    expect(orders.get('gt-1')).toBeLessThan(orders.get('super-1') as number);
  });

  it('rechaza dos sucesos de una misma serie en la misma posición', () => {
    expect(() => eventOrders([event('a', 'db', 1), event('b', 'db', 1)], ORDER)).toThrow(/misma posición/);
  });

  it('el contenido del suceso lleva su lugar global y conserva verified', () => {
    expect(buildEventContent(events[0], 4)).toEqual({ id: 'event-super-1', kind: 'event', series: 'super', payload: { text: 'super-1', order: 4 }, verified: false });
  });
});
