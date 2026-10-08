// Pruebas sobre los datos reales de Naruto (data/naruto/): lo que los tests de la lógica no pueden
// ver, como que ninguna frase delate a su personaje, que cada contenido apunte a alguien que existe,
// que los arcos de debut coincidan con la serie de debut o que Conexiones tenga tableros de sobra.

import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Content, Entity } from '../../../src/engine/types.ts';
import arcsJson from '../../../data/naruto/arcs.json';
import contentJson from '../../../data/naruto/content.json';
import charactersJson from '../../../data/naruto/entities.json';
import { ROOT } from './api.ts';
import { SERIES, type GroupSrc } from './schemas.ts';
import { countBoards, leaksName } from './transform.ts';

const characters = charactersJson as Entity[];
const contents = contentJson as Content[];
const arcs = arcsJson as { series: Array<{ id: string; order: number }>; arcs: Array<{ id: string; name: string; series: string; order: number }> };

const characterById = new Map(characters.map((entity) => [entity.id, entity]));
const arcByOrder = new Map(arcs.arcs.map((arc) => [arc.order, arc]));
const of = (kind: string) => contents.filter((content) => content.kind === kind);
const quotes = of('quote');
const teams = of('team');
const emojis = of('emoji');
const groups = of('group');

const CLASSIC_KEYS = [
  'genero', 'afiliaciones', 'tiposDeJutsu', 'kekkeiGenkai', 'naturalezas', 'atributos', 'arcoDebut',
  'estadoVital', 'ocupacion', 'imagenTransparente',
];
const SET_KEYS = ['afiliaciones', 'tiposDeJutsu', 'kekkeiGenkai', 'naturalezas', 'atributos'];

describe('personajes', () => {
  it('hay entre 150 y 200, con ids únicos', () => {
    expect(characters.length).toBeGreaterThanOrEqual(150);
    expect(characters.length).toBeLessThanOrEqual(200);
    expect(new Set(characters.map((entity) => entity.id)).size).toBe(characters.length);
  });

  it('todos tienen los atributos del Clásico, completos o con null explícito', () => {
    for (const entity of characters) {
      for (const key of CLASSIC_KEYS) expect(key in entity.attrs, `${entity.id}.${key}`).toBe(true);
      for (const key of SET_KEYS) {
        const value = entity.attrs[key];
        expect(Array.isArray(value), `${entity.id}.${key}`).toBe(true);
        for (const item of value as Array<string | { value: string }>) {
          expect(typeof (typeof item === 'string' ? item : item.value), `${entity.id}.${key}`).toBe('string');
        }
      }
      expect(['Vivo', 'Muerto', 'Incapacitado'], entity.id).toContain(entity.attrs.estadoVital);
      expect(['Masculino', 'Femenino', null], entity.id).toContain(entity.attrs.genero);
      expect(Number.isInteger(entity.attrs.arcoDebut), entity.id).toBe(true);
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

  it('el arco de debut existe y es de la serie de debut: de lo contrario la flecha del Clásico mentiría', () => {
    for (const entity of characters) {
      const arc = arcByOrder.get(entity.attrs.arcoDebut as number);
      expect(arc, `${entity.id}: arcoDebut ${String(entity.attrs.arcoDebut)}`).toBeDefined();
      expect(arc?.series, entity.id).toBe(entity.series[0]);
    }
  });

  it('cada serie tiene personajes y alcanzan para el Clásico (mínimo 20)', () => {
    for (const series of SERIES) {
      expect(characters.filter((entity) => entity.series.includes(series)).length, series).toBeGreaterThanOrEqual(20);
    }
  });

  it('un valor de un conjunto con etiqueta de serie la lleva válida', () => {
    for (const entity of characters) {
      for (const item of entity.attrs.afiliaciones as Array<string | { value: string; series?: string }>) {
        if (typeof item !== 'string' && item.series !== undefined) expect(SERIES as readonly string[], entity.id).toContain(item.series);
      }
    }
  });

  it('la imagen, si hay, existe en los dos tamaños; sin imagen, no hay flag de transparencia', () => {
    for (const entity of characters) {
      if (entity.image === undefined) {
        expect(entity.attrs.imagenTransparente, entity.id).toBeNull();
        continue;
      }
      expect([0, 1], entity.id).toContain(entity.attrs.imagenTransparente);
      for (const size of [256, 512]) expect(existsSync(path.join(ROOT, 'public', 'img', `${entity.image}-${size}.webp`)), `${entity.id} ${size}`).toBe(true);
    }
  });
});

describe('arcos', () => {
  it('las series y los arcos tienen posiciones consecutivas desde 1, y las series en orden canónico', () => {
    expect(arcs.series.map((item) => item.id)).toEqual([...SERIES]);
    expect(arcs.arcs.map((arc) => arc.order)).toEqual(arcs.arcs.map((_, index) => index + 1));
    const seriesOrder = arcs.arcs.map((arc) => SERIES.indexOf(arc.series as (typeof SERIES)[number]));
    expect(seriesOrder).toEqual([...seriesOrder].sort((a, b) => a - b));
  });

  it('los ids y los nombres no se repiten', () => {
    expect(new Set(arcs.arcs.map((arc) => arc.id)).size).toBe(arcs.arcs.length);
    expect(new Set(arcs.arcs.map((arc) => arc.name)).size).toBe(arcs.arcs.length);
  });
});

describe('contenidos', () => {
  it('los ids no se repiten y cada contenido que tiene respuesta apunta a un personaje que existe y de esa serie', () => {
    expect(new Set(contents.map((content) => content.id)).size).toBe(contents.length);
    for (const content of contents) {
      if (content.entityId === undefined) continue;
      const entity = characterById.get(content.entityId);
      expect(entity, `${content.id}: ${content.entityId}`).toBeDefined();
      expect(entity?.series, `${content.id}: serie ${content.series}`).toContain(content.series);
    }
  });

  it('las respuestas extra (`accepts`) existen y no repiten a la principal', () => {
    for (const content of contents) {
      const accepts = content.payload.accepts;
      if (!Array.isArray(accepts)) continue;
      for (const id of accepts as string[]) {
        expect(characterById.has(id), `${content.id}: ${id}`).toBe(true);
        expect(id, content.id).not.toBe(content.entityId);
      }
    }
  });
});

describe('frases', () => {
  it('hay de al menos 10 personajes distintos, para que el modo Frase pueda abrirse cuando se verifiquen', () => {
    expect(new Set(quotes.map((content) => content.entityId)).size).toBeGreaterThanOrEqual(10);
  });

  it('ninguna delata a su personaje con su nombre, un alias o una palabra de su nombre', () => {
    for (const quote of quotes) {
      const character = characterById.get(quote.entityId as string) as Entity;
      const words = character.name.es.split(/\s+/).filter((word) => word.length > 3);
      expect(leaksName(quote.payload.text as string, [character.name.es, ...character.aliases, ...words]), `${quote.id}: ${character.name.es}`).toBe(false);
    }
  });

  it('el arco que dicen existe y es de la serie de la frase; la fuente es una página de Narutopedia', () => {
    const arcsByName = new Map(arcs.arcs.map((arc) => [arc.name, arc]));
    for (const quote of quotes) {
      const arc = arcsByName.get(quote.payload.arc as string);
      expect(arc, `${quote.id}: ${String(quote.payload.arc)}`).toBeDefined();
      expect(arc?.series, quote.id).toBe(quote.series);
      expect(quote.payload.source as string, quote.id).toMatch(/^https:\/\/naruto\.fandom\.com\/wiki\//);
    }
  });
});

describe('jutsus', () => {
  it('cada uno que está en el dataset tiene sus dos imágenes y el tamaño que dice', () => {
    for (const jutsu of of('jutsu')) {
      for (const size of [256, 512]) expect(existsSync(path.join(ROOT, 'public', 'img', `${jutsu.payload.image as string}-${size}.webp`)), `${jutsu.id} ${size}`).toBe(true);
      expect(jutsu.payload.width, jutsu.id).toBeGreaterThan(0);
    }
  });
});

describe('equipos', () => {
  it('hay para al menos 10 personajes distintos y ninguno muestra a quien tiene que adivinarse', () => {
    expect(new Set(teams.map((content) => content.entityId)).size).toBeGreaterThanOrEqual(10);
    for (const team of teams) {
      const answer = characterById.get(team.entityId as string) as Entity;
      expect(team.payload.items as string[], team.id).not.toContain(answer.name.es);
      expect((team.payload.items as string[]).length, team.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('lo que se muestra son nombres de personajes del juego', () => {
    const names = new Set(characters.map((entity) => entity.name.es));
    for (const team of teams) {
      for (const item of team.payload.items as string[]) expect(names.has(item), `${team.id}: ${item}`).toBe(true);
    }
  });
});

describe('emojis', () => {
  it('hay de al menos 10 personajes distintos, uno por personaje, y solo llevan emojis', () => {
    expect(new Set(emojis.map((content) => content.entityId)).size).toBeGreaterThanOrEqual(10);
    expect(new Set(emojis.map((content) => content.entityId)).size).toBe(emojis.length);
    for (const content of [...emojis, ...of('emoji-arc')]) {
      expect(content.payload.text as string, content.id).toMatch(/^[\p{Extended_Pictographic}\p{Emoji_Modifier}‍️ ]+$/u);
    }
  });

  it('los de arco apuntan a un arco que existe', () => {
    const ids = new Set(arcs.arcs.map((arc) => arc.id));
    for (const content of of('emoji-arc')) expect(ids.has(content.payload.arc as string), content.id).toBe(true);
  });
});

describe('grupos de Conexiones', () => {
  const asSrc = (content: Content): GroupSrc => ({
    id: content.id.replace(/^group-/, ''),
    name: content.payload.name as string,
    category: content.payload.category as string,
    difficulty: content.payload.difficulty as number,
    series: content.series as GroupSrc['series'],
    members: content.payload.members as string[],
    verified: content.verified,
  });
  const sources = groups.map(asSrc);

  it('hay de las cuatro dificultades y todos tienen al menos 4 miembros, que existen', () => {
    for (const level of [1, 2, 3, 4]) expect(sources.some((group) => group.difficulty === level), `dificultad ${level}`).toBe(true);
    for (const group of sources) {
      expect(group.members.length, group.id).toBeGreaterThanOrEqual(4);
      expect(new Set(group.members).size, group.id).toBe(group.members.length);
      for (const member of group.members) expect(characterById.has(member), `${group.id}: ${member}`).toBe(true);
    }
  });

  it('con todas las series activas se pueden armar al menos 30 tableros distintos', () => {
    expect(countBoards(sources)).toBeGreaterThanOrEqual(30);
  });

  it('los que están en más de un grupo se marcan, y de forma simétrica', () => {
    const membersOf = new Map(sources.map((group) => [group.id, new Set(group.members)]));
    const groupsOf = new Map<string, string[]>();
    for (const group of sources) for (const member of group.members) groupsOf.set(member, [...(groupsOf.get(member) ?? []), group.id]);
    for (const content of groups) {
      const id = content.id.replace(/^group-/, '');
      const shared = content.payload.shared as Record<string, string[]>;
      for (const member of content.payload.members as string[]) {
        const others = (groupsOf.get(member) ?? []).filter((other) => other !== id);
        if (others.length === 0) expect(shared[member], `${id}: ${member}`).toBeUndefined();
        else expect([...shared[member]].sort(), `${id}: ${member}`).toEqual([...others].sort());
        for (const other of others) expect(membersOf.get(other)?.has(member)).toBe(true);
      }
      expect(Object.keys(shared).every((member) => (content.payload.members as string[]).includes(member)), id).toBe(true);
    }
  });
});
