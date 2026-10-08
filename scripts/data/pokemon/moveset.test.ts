import { describe, expect, it } from 'vitest';
import type { Entity } from '../../../src/engine/types.ts';
import { MOVES_PER_POKEMON, buildMovesetContents } from './moveset.ts';
import { contentSchema, type Move } from './schemas.ts';
import { countLearners } from './moves.ts';

const entity = (id: string, series = 'g1', aliases: string[] = []): Entity => ({
  id,
  name: { es: id.charAt(0).toUpperCase() + id.slice(1), en: id.charAt(0).toUpperCase() + id.slice(1) },
  aliases,
  series: [series],
  image: `pokemon/${id}`,
  attrs: {},
});

function move(id: number, name: string, spanish: string | null = `Mov ${name}`): Move {
  return {
    id,
    name,
    names: [
      { name, language: { name: 'en' } },
      ...(spanish === null ? [] : [{ name: spanish, language: { name: 'es' } }]),
    ],
    type: { name: 'normal', url: 'https://pokeapi.co/api/v2/type/1/' },
    flavor_text_entries: [],
    learned_by_pokemon: [],
  };
}

// Del más común al más raro: tackle lo aprenden 500 especies; rare-3, una sola.
const MOVES = [
  move(1, 'tackle'),
  move(2, 'growl'),
  move(3, 'surf'),
  move(4, 'thunderbolt'),
  move(5, 'rare-1'),
  move(6, 'rare-2'),
  move(7, 'rare-3'),
];
const COUNTS = new Map([
  ['tackle', 500],
  ['growl', 400],
  ['surf', 120],
  ['thunderbolt', 80],
  ['rare-1', 6],
  ['rare-2', 3],
  ['rare-3', 1],
]);

function build(moves: string[], overrides: { moves?: Move[]; counts?: Map<string, number>; pokemon?: Entity } = {}) {
  return buildMovesetContents({
    pokemon: [{ entity: overrides.pokemon ?? entity('pikachu'), moves }],
    moves: overrides.moves ?? MOVES,
    learnerCount: overrides.counts ?? COUNTS,
  });
}

describe('buildMovesetContents', () => {
  it('elige los 4 menos comunes y los presenta del más común al menos común', () => {
    const { contents } = build(['tackle', 'growl', 'surf', 'thunderbolt', 'rare-1', 'rare-2', 'rare-3']);
    expect(contents).toHaveLength(1);
    // Los 4 más raros: thunderbolt (80), rare-1 (6), rare-2 (3), rare-3 (1). De mayor a menor cantidad.
    expect(contents[0].payload.items).toEqual(['Mov thunderbolt', 'Mov rare-1', 'Mov rare-2', 'Mov rare-3']);
  });

  it('arma el contenido del Pokémon con su serie, verificado', () => {
    const { contents } = build(['surf', 'thunderbolt', 'rare-1', 'rare-2'], { pokemon: entity('mew', 'g1') });
    expect(contents[0]).toEqual({
      id: 'moveset-mew',
      kind: 'moveset',
      entityId: 'mew',
      series: 'g1',
      payload: { items: ['Mov surf', 'Mov thunderbolt', 'Mov rare-1', 'Mov rare-2'] },
      verified: true,
    });
    expect(contentSchema.safeParse(contents[0]).success).toBe(true);
  });

  it('con exactamente 4 movimientos, los usa todos', () => {
    expect(MOVES_PER_POKEMON).toBe(4);
    expect(build(['surf', 'thunderbolt', 'rare-1', 'rare-2']).contents).toHaveLength(1);
  });

  it('no depende del orden en que la API lista los movimientos', () => {
    const forward = build(['tackle', 'growl', 'surf', 'thunderbolt', 'rare-1', 'rare-2', 'rare-3']);
    const backward = build(['rare-3', 'rare-2', 'rare-1', 'thunderbolt', 'surf', 'growl', 'tackle']);
    expect(backward.contents).toEqual(forward.contents);
  });

  it('si dos movimientos empatan en cuántos lo aprenden, gana el de menor id', () => {
    const tied = new Map(COUNTS).set('surf', 80); // surf y thunderbolt, 80 cada uno
    const { contents } = build(['surf', 'thunderbolt', 'rare-1', 'rare-2', 'rare-3'], { counts: tied });
    // Los 4 más raros incluyen rare-3, rare-2, rare-1 y el de menor id entre surf (3) y thunderbolt (4): surf.
    expect(contents[0].payload.items).toEqual(['Mov surf', 'Mov rare-1', 'Mov rare-2', 'Mov rare-3']);
  });

  it('un Pokémon con menos de 4 movimientos que se puedan mostrar queda afuera y se informa', () => {
    const result = build(['tackle', 'growl', 'surf']);
    expect(result.contents).toEqual([]);
    expect(result.without).toEqual([{ id: 'pikachu', usable: 3 }]);
  });

  it('un movimiento sin nombre en español no cuenta', () => {
    const noSpanish = MOVES.map((item) => (item.name === 'rare-3' ? move(7, 'rare-3', null) : item));
    const { contents } = build(['surf', 'thunderbolt', 'rare-1', 'rare-2', 'rare-3'], { moves: noSpanish });
    expect(contents[0].payload.items).toEqual(['Mov surf', 'Mov thunderbolt', 'Mov rare-1', 'Mov rare-2']);
  });

  it('un movimiento cuyo nombre contiene el del Pokémon no cuenta', () => {
    const leaky = MOVES.map((item) => (item.name === 'rare-3' ? move(7, 'rare-3', 'Pikachu Papow') : item));
    const { contents } = build(['surf', 'thunderbolt', 'rare-1', 'rare-2', 'rare-3'], { moves: leaky });
    expect(contents[0].payload.items).not.toContain('Pikachu Papow');
    expect(contents[0].payload.items).toHaveLength(4);
  });

  it('un movimiento que no está en la lista de la API es un error', () => {
    expect(() => build(['tackle', 'no-existe'])).toThrow(/no está en la lista/);
  });

  it('no repite movimientos con el mismo nombre en español', () => {
    const dup = [...MOVES, move(8, 'rare-1b', 'Mov rare-1')];
    const counts = new Map(COUNTS).set('rare-1b', 7);
    const { contents } = build(['surf', 'thunderbolt', 'rare-1', 'rare-1b', 'rare-2', 'rare-3'], { moves: dup, counts });
    const items = contents[0].payload.items as string[];
    expect(new Set(items).size).toBe(items.length);
  });

  it('un movimiento repetido en la lista del Pokémon cuenta una vez', () => {
    const { without } = build(['tackle', 'tackle', 'growl', 'surf']);
    expect(without[0].usable).toBe(3);
  });

  it('la cantidad se toma de las especies: sin dato cuenta como 0 (el más raro)', () => {
    const { contents } = build(['surf', 'thunderbolt', 'rare-1', 'rare-2', 'tackle'], { counts: new Map() });
    // Todos empatan en 0: gana el orden por id (tackle 1, surf 3, thunderbolt 4, rare-1 5), presentados igual.
    expect(contents[0].payload.items).toEqual(['Mov tackle', 'Mov surf', 'Mov thunderbolt', 'Mov rare-1']);
  });
});

describe('countLearners', () => {
  const learner = (id: number) => ({ name: `p${id}`, url: `https://pokeapi.co/api/v2/pokemon/${id}/` });
  const withLearners = (name: string, ids: number[]): Move => ({ ...move(1, name), learned_by_pokemon: ids.map(learner) });
  // 25 y 10080 (una forma de Pikachu) son la misma especie.
  const speciesOf = (id: number) => (id === 10080 ? 25 : id <= 1025 ? id : undefined);

  it('cuenta especies, no Pokémon: una forma alternativa es su especie', () => {
    expect(countLearners([withLearners('volt-tackle', [25, 10080, 26])], speciesOf).get('volt-tackle')).toBe(2);
  });

  it('un movimiento sin aprendices cuenta 0', () => {
    expect(countLearners([withLearners('shadow-rush', [])], speciesOf).get('shadow-rush')).toBe(0);
  });

  it('ignora a los aprendices de especie desconocida', () => {
    expect(countLearners([withLearners('raro', [25, 99999])], speciesOf).get('raro')).toBe(1);
  });
});
