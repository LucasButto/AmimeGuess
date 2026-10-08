import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { pickDaily, type DailyContext } from '@/engine/daily';
import type { Content, Entity } from '@/engine/types';
import {
  candidatesOf,
  failedCount,
  isCorrect,
  itemsOf,
  pickContent,
  slotsOf,
  visibleCount,
  winningAttempt,
} from './logic';
import type { RevealListConfig } from './types';

const entity = (id: string, series: string[]): Entity => ({
  id,
  name: { es: id },
  aliases: [],
  series,
  image: `test/${id}`,
  attrs: {},
});

const list = (id: string, entityId: string | undefined, series: string, payload: Record<string, unknown>, kind = 'moveset'): Content => ({
  id,
  kind,
  entityId,
  series,
  payload,
  verified: true,
});

const CONFIG: RevealListConfig = { contentKind: 'moveset', field: 'items', label: 'Movimientos' };
const ctx: DailyContext = { franchise: 'test', mode: 'moveset', filterKey: 'all', day: 100 };

describe('itemsOf', () => {
  it('lee la lista de pistas, en orden', () => {
    expect(itemsOf(list('a', 'x', 'g1', { items: ['uno', 'dos', 'tres'] }), 'items')).toEqual(['uno', 'dos', 'tres']);
  });

  it('descarta lo que no es un texto o está vacío', () => {
    expect(itemsOf(list('a', 'x', 'g1', { items: ['uno', '', 3, null, 'dos'] }), 'items')).toEqual(['uno', 'dos']);
  });

  it('un campo que falta o que no es una lista es "sin pistas"', () => {
    expect(itemsOf(list('a', 'x', 'g1', {}), 'items')).toEqual([]);
    expect(itemsOf(list('a', 'x', 'g1', { items: 'uno' }), 'items')).toEqual([]);
  });

  it('lee el campo que dice la configuración', () => {
    expect(itemsOf(list('a', 'x', 'g1', { miembros: ['a', 'b'] }), 'miembros')).toEqual(['a', 'b']);
  });
});

describe('candidatesOf', () => {
  const entities = [entity('a', ['g1']), entity('b', ['g2']), entity('c', ['g1']), entity('d', ['g1', 'g3'])];
  const contents = [
    list('m-a', 'a', 'g1', { items: ['x', 'y', 'z', 'w'] }),
    list('m-b', 'b', 'g2', { items: ['x'] }),
    list('otro-c', 'c', 'g1', { items: ['x'] }, 'team'),
    list('m-huerfano', undefined, 'g1', { items: ['x'] }),
    list('m-d', 'd', 'g1', { items: ['x', 'y'] }),
  ];

  it('ofrece las entidades elegibles que tienen una lista del tipo pedido', () => {
    expect(candidatesOf(entities, contents, ['g1', 'g2'], CONFIG).map((c) => c.id)).toEqual(['a', 'b', 'd']);
  });

  it('con una serie apagada, ni la entidad ni su lista aparecen (reglas 1 y 2)', () => {
    expect(candidatesOf(entities, contents, ['g1'], CONFIG).map((c) => c.id)).toEqual(['a', 'd']);
    expect(candidatesOf(entities, contents, ['g2'], CONFIG).map((c) => c.id)).toEqual(['b']);
    expect(candidatesOf(entities, contents, ['g3'], CONFIG)).toEqual([]);
  });

  it('una lista vacía no sirve: no habría nada que revelar', () => {
    const empty = [list('m-a', 'a', 'g1', { items: [] })];
    expect(candidatesOf(entities, empty, ['g1'], CONFIG)).toEqual([]);
  });

  it('la respuesta puede ser distinta de lo que dicen las pistas', () => {
    // Un equipo: se muestran dos miembros y la respuesta es el que falta.
    const team = [entity('naruto', ['g1']), entity('sasuke', ['g1']), entity('sakura', ['g1'])];
    const content = [list('team-7', 'sakura', 'g1', { items: ['Naruto', 'Sasuke'] })];
    const [only] = candidatesOf(team, content, ['g1'], CONFIG);
    expect(only.id).toBe('sakura');
    expect(itemsOf(only.contents[0], 'items')).toEqual(['Naruto', 'Sasuke']);
    // Los que aparecen como pista siguen pudiendo ser un intento, pero no son la respuesta.
    expect(isCorrect('naruto', only.id, only.contents[0])).toBe(false);
    expect(isCorrect('sakura', only.id, only.contents[0])).toBe(true);
  });

  it('el orden de los datos no cambia el resultado', () => {
    const reversed = candidatesOf([...entities].reverse(), [...contents].reverse(), ['g1', 'g2'], CONFIG);
    expect(reversed.map((c) => c.id).sort()).toEqual(['a', 'b', 'd']);
    const day = (cands: ReturnType<typeof candidatesOf>) => {
      const answer = pickDaily(cands, ctx);
      return `${answer.id}/${pickContent(answer, ctx).id}`;
    };
    expect(day(reversed)).toBe(day(candidatesOf(entities, contents, ['g1', 'g2'], CONFIG)));
  });
});

describe('visibleCount y slotsOf', () => {
  it('al empezar se ve una pista y cada fallo revela una más', () => {
    expect([0, 1, 2, 3].map((failed) => visibleCount(failed, 4))).toEqual([1, 2, 3, 4]);
  });

  it('nunca pasa del total, ni con muchos fallos', () => {
    expect(visibleCount(3, 4)).toBe(4);
    expect(visibleCount(40, 4)).toBe(4);
    expect(visibleCount(Infinity, 4)).toBe(4);
  });

  it('con pistas iniciales, arranca con esas', () => {
    expect([0, 1, 2].map((failed) => visibleCount(failed, 5, 2))).toEqual([2, 3, 4]);
  });

  it('siempre se ve al menos una, aunque la configuración diga 0 o haya fallos negativos', () => {
    expect(visibleCount(0, 4, 0)).toBe(1);
    expect(visibleCount(-5, 4)).toBe(1);
  });

  it('con una lista corta, se ve toda desde el principio', () => {
    expect(visibleCount(0, 1)).toBe(1);
    expect(visibleCount(0, 2, 5)).toBe(2);
  });

  it('marca cuáles están reveladas, con su posición desde 1', () => {
    expect(slotsOf(['a', 'b', 'c', 'd'], 1)).toEqual([
      { position: 1, text: 'a', revealed: true },
      { position: 2, text: 'b', revealed: true },
      { position: 3, text: 'c', revealed: false },
      { position: 4, text: 'd', revealed: false },
    ]);
  });

  it('con Infinity (partida terminada) quedan todas reveladas', () => {
    expect(slotsOf(['a', 'b', 'c'], Infinity).every((slot) => slot.revealed)).toBe(true);
  });
});

describe('intentos (lógica compartida con text-clue)', () => {
  const content = list('m', 'pikachu', 'g1', { items: ['x'], accepts: ['raichu'] });

  it('un fallo es un intento que no acierta; una respuesta equivalente acierta', () => {
    expect(failedCount(['eevee', 'raichu'], 'pikachu', content)).toBe(1);
    expect(winningAttempt(['eevee', 'raichu'], 'pikachu', content)).toBe('raichu');
  });
});

describe('src/modes/reveal-list', () => {
  const dir = fileURLToPath(new URL('.', import.meta.url));
  const code = readFileSync(`${dir}logic.ts`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('la lógica no usa azar ni reloj (regla 1 de CLAUDE.md)', () => {
    for (const pattern of [/Math\.random\b/, /Date\.now\b/, /new Date\(/, /getTimezoneOffset/, /performance\.now\b/]) {
      expect(code).not.toMatch(pattern);
    }
  });

  it('la lógica no importa React ni nada de una franquicia (regla 2)', () => {
    expect(code).not.toMatch(/from\s+['"](react|next|@\/franchises|@\/components)/);
  });
});
