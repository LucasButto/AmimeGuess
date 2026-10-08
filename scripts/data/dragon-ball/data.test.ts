// Pruebas sobre los datos reales de Dragon Ball (data/dragon-ball/): lo que los tests de la
// lógica no pueden ver, como que ninguna frase delate a su personaje, que cada contenido apunte
// a alguien que existe o que los números de debut coincidan con la cronología.

import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Content, Entity } from '../../../src/engine/types.ts';
import charactersJson from '../../../data/dragon-ball/entities.json';
import formsJson from '../../../data/dragon-ball/transformations.json';
import contentJson from '../../../data/dragon-ball/content.json';
import sagasJson from '../../../data/dragon-ball/sagas.json';
import { ROOT } from './api.ts';
import { SERIES } from './schemas.ts';
import { leaksName } from './transform.ts';

const characters = charactersJson as Entity[];
const forms = formsJson as Entity[];
const contents = contentJson as Content[];
const sagas = sagasJson as { series: Array<{ id: string; order: number }>; sagas: Array<{ id: string; name: string; series: string; order: number }> };

const characterById = new Map(characters.map((entity) => [entity.id, entity]));
const seriesRank = new Map(sagas.series.map((item) => [item.id, item.order]));
const quotes = contents.filter((content) => content.kind === 'quote');
const events = contents.filter((content) => content.kind === 'event');
const techniques = contents.filter((content) => content.kind === 'technique');

const CLASSIC_KEYS = [
  'genero', 'razas', 'afiliaciones', 'planeta', 'transformaciones', 'serieDebut', 'sagaDebut',
  'estadoVital', 'tecnica', 'ki', 'kiOficial', 'imagenTransparente',
];

describe('personajes', () => {
  it('hay entre 100 y 150, con ids únicos', () => {
    expect(characters.length).toBeGreaterThanOrEqual(100);
    expect(characters.length).toBeLessThanOrEqual(150);
    expect(new Set(characters.map((entity) => entity.id)).size).toBe(characters.length);
  });

  it('todos tienen los atributos del Clásico, completos o con null explícito', () => {
    for (const entity of characters) {
      for (const key of CLASSIC_KEYS) expect(key in entity.attrs, `${entity.id}.${key}`).toBe(true);
      const { genero, razas, afiliaciones, serieDebut, sagaDebut, estadoVital } = entity.attrs;
      expect(typeof genero, entity.id).toBe('string');
      expect(Array.isArray(razas) && razas.length > 0, `${entity.id}: sin raza`).toBe(true);
      expect(Array.isArray(afiliaciones), entity.id).toBe(true);
      expect(Number.isInteger(serieDebut), entity.id).toBe(true);
      expect(Number.isInteger(sagaDebut), entity.id).toBe(true);
      expect(['Vivo', 'Muerto', 'Desconocido'], entity.id).toContain(estadoVital);
    }
  });

  it('cada uno aparece en al menos una serie, en orden canónico y sin repetir', () => {
    for (const entity of characters) {
      expect(entity.series.length, entity.id).toBeGreaterThan(0);
      const indexes = entity.series.map((series) => SERIES.indexOf(series as (typeof SERIES)[number]));
      expect(indexes.every((index) => index >= 0), entity.id).toBe(true);
      expect(indexes, entity.id).toEqual([...indexes].sort((a, b) => a - b));
      expect(new Set(entity.series).size, entity.id).toBe(entity.series.length);
    }
  });

  it('el número de serie de debut y el de saga de debut salen de la cronología', () => {
    const sagaById = new Map(sagas.sagas.map((saga) => [saga.id, saga]));
    const sagaByOrder = new Map(sagas.sagas.map((saga) => [saga.order, saga]));
    for (const entity of characters) {
      const debut = entity.series[0];
      expect(entity.attrs.serieDebut, `${entity.id}: serieDebut`).toBe(seriesRank.get(debut));
      const saga = sagaByOrder.get(entity.attrs.sagaDebut as number);
      expect(saga, `${entity.id}: sagaDebut ${String(entity.attrs.sagaDebut)}`).toBeDefined();
      expect(saga?.series, `${entity.id}: su saga de debut es de otra serie`).toBe(debut);
      expect(sagaById.has(saga?.id ?? ''), entity.id).toBe(true);
    }
  });

  it('los valores de transformaciones llevan la serie en que se ven', () => {
    let total = 0;
    for (const entity of characters) {
      for (const item of entity.attrs.transformaciones as Array<{ value: string; series?: string }>) {
        total++;
        expect(typeof item, entity.id).toBe('object');
        expect(SERIES, `${entity.id}: ${item.value}`).toContain(item.series);
      }
    }
    expect(total).toBeGreaterThan(40);
  });

  it('el ki es positivo y solo es oficial si tiene valor', () => {
    for (const entity of characters) {
      const { ki, kiOficial } = entity.attrs;
      if (ki === null) {
        expect(kiOficial, entity.id).toBeNull();
      } else {
        expect(typeof ki === 'number' && ki > 0 && Number.isFinite(ki), entity.id).toBe(true);
        expect([0, 1], entity.id).toContain(kiOficial);
      }
    }
    expect(characters.filter((entity) => entity.attrs.ki !== null).length).toBeGreaterThan(10);
  });

  it('con una sola serie activa el Clásico llega al pool mínimo de 20', () => {
    for (const series of SERIES) {
      expect(characters.filter((entity) => entity.series.includes(series)).length, series).toBeGreaterThanOrEqual(20);
    }
  });

  it('las imágenes existen en los dos tamaños; las transparentes sirven para Silueta', () => {
    for (const entity of characters) {
      if (entity.image === undefined) {
        expect(entity.attrs.imagenTransparente, entity.id).toBeNull();
        continue;
      }
      expect([0, 1], entity.id).toContain(entity.attrs.imagenTransparente);
      for (const size of [256, 512]) {
        expect(existsSync(path.join(ROOT, 'public', 'img', `${entity.image}-${size}.webp`)), `${entity.id} ${size}`).toBe(true);
      }
    }
    expect(characters.filter((entity) => entity.attrs.imagenTransparente === 1).length).toBeGreaterThanOrEqual(10);
  });
});

describe('formas', () => {
  it('tienen una sola serie, imagen y un personaje que existe', () => {
    expect(forms.length).toBeGreaterThanOrEqual(10);
    expect(new Set(forms.map((entity) => entity.id)).size).toBe(forms.length);
    for (const form of forms) {
      expect(form.series.length, form.id).toBe(1);
      expect(form.image, form.id).toBeDefined();
      expect(characters.some((entity) => entity.name.es === form.attrs.personaje), `${form.id}: personaje ${String(form.attrs.personaje)}`).toBe(true);
      for (const size of [256, 512]) {
        expect(existsSync(path.join(ROOT, 'public', 'img', `${form.image}-${size}.webp`)), `${form.id} ${size}`).toBe(true);
      }
    }
  });

  it('cada forma figura en las transformaciones de su personaje, con la misma serie', () => {
    for (const form of forms) {
      const owner = characters.find((entity) => entity.name.es === form.attrs.personaje);
      const list = (owner?.attrs.transformaciones ?? []) as Array<{ value: string; series?: string }>;
      expect(list.some((item) => item.value === form.attrs.forma && item.series === form.series[0]), form.id).toBe(true);
    }
  });
});

describe('frases', () => {
  it('hay más de 40, todas de un personaje que existe y con la página de origen', () => {
    expect(quotes.length).toBeGreaterThan(40);
    for (const quote of quotes) {
      expect(characterById.has(quote.entityId ?? ''), quote.id).toBe(true);
      expect(String(quote.payload.source), quote.id).toMatch(/^https:\/\/dragonball\.fandom\.com\/es\/wiki\//);
    }
  });

  it('ninguna dice el nombre de quien la dijo', () => {
    const leaks = quotes.filter((quote) => {
      const speaker = characterById.get(quote.entityId ?? '');
      return speaker !== undefined && leaksName(String(quote.payload.text), [speaker.name.es, ...speaker.aliases]);
    });
    expect(leaks.map((quote) => quote.id)).toEqual([]);
  });

  it('todas esperan verificación a mano: ninguna entra al pool sin verified: true', () => {
    expect(quotes.every((quote) => quote.verified === false)).toBe(true);
  });
});

describe('sucesos de la línea de tiempo', () => {
  it('tienen un lugar único y seguido en la cronología', () => {
    const orders = events.map((event) => event.payload.order as number).sort((a, b) => a - b);
    expect(orders).toEqual(orders.map((_, index) => index + 1));
    expect(events.length).toBeGreaterThanOrEqual(10);
  });

  it('el orden respeta la cronología de las series', () => {
    const sorted = [...events].sort((a, b) => (a.payload.order as number) - (b.payload.order as number));
    const ranks = sorted.map((event) => seriesRank.get(event.series) as number);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });
});

describe('técnicas', () => {
  it('las que ya tienen imagen apuntan a personajes que existen y a archivos que están', () => {
    for (const technique of techniques) {
      expect(characterById.has(technique.entityId ?? ''), technique.id).toBe(true);
      for (const other of technique.payload.accepts as string[]) expect(characterById.has(other), `${technique.id}: ${other}`).toBe(true);
      for (const size of [256, 512]) {
        expect(existsSync(path.join(ROOT, 'public', 'img', `${String(technique.payload.image)}-${size}.webp`)), `${technique.id} ${size}`).toBe(true);
      }
    }
  });
});

describe('sagas', () => {
  it('están numeradas seguido desde 1 y cada una es de una serie conocida', () => {
    const orders = sagas.sagas.map((saga) => saga.order);
    expect(orders).toEqual(orders.map((_, index) => index + 1));
    for (const saga of sagas.sagas) expect(seriesRank.has(saga.series), saga.id).toBe(true);
  });

  it('las series están numeradas de 1 a 5 sin repetir', () => {
    expect(sagas.series.map((item) => item.order).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
