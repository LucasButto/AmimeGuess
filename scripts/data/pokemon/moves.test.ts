import { describe, expect, it } from 'vitest';
import type { Entity } from '../../../src/engine/types.ts';
import { buildSignatureContents, learnerPokemonId, pickMoveText, type SignatureInput } from './moves.ts';
import { contentSchema, type Move } from './schemas.ts';

const url = (resource: string, id: number) => `https://pokeapi.co/api/v2/${resource}/${id}/`;

function entity(id: string, species: number, series = 'g1', aliases: string[] = []): Entity {
  return { id, name: { es: id.charAt(0).toUpperCase() + id.slice(1), en: id.charAt(0).toUpperCase() + id.slice(1) }, aliases, series: [series], image: `pokemon/${id}`, attrs: { dex: species } };
}

const PICHU = entity('pichu', 172, 'g2');
const PIKACHU = entity('pikachu', 25);
const RAICHU = entity('raichu', 26);
const EEVEE = entity('eevee', 133);
const SMEARGLE = entity('smeargle', 235, 'g2');

// Especie -> entidad y cadena evolutiva. Pichu, Pikachu y Raichu son una sola línea.
const ENTITIES = new Map([PICHU, PIKACHU, RAICHU, EEVEE, SMEARGLE].map((item) => [Number(item.attrs.dex), item]));
const CHAINS = new Map([
  [172, 10],
  [25, 10],
  [26, 10],
  [133, 67],
  [235, 120],
]);
// Pokémon de la API (id) -> especie. 10080 es una forma alternativa de Pikachu.
const SPECIES_OF = new Map([
  [172, 172],
  [25, 25],
  [26, 26],
  [133, 133],
  [235, 235],
  [10080, 25],
]);

const flavor = (text: string, versionGroup: number, language = 'es') => ({
  flavor_text: text,
  language: { name: language },
  version_group: { name: `vg-${versionGroup}`, url: url('version-group', versionGroup) },
});

function move(name: string, learners: number[], overrides: Partial<Move> = {}): Move {
  return {
    id: 1,
    name,
    names: [
      { name, language: { name: 'en' } },
      { name: `Mov ${name}`, language: { name: 'es' } },
    ],
    type: { name: 'electric', url: url('type', 13) },
    flavor_text_entries: [flavor(`Texto de ${name}.`, 5)],
    learned_by_pokemon: learners.map((id) => ({ name: `pokemon-${id}`, url: url('pokemon', id) })),
    ...overrides,
  };
}

function build(moves: Move[], overrides: Partial<SignatureInput> = {}) {
  return buildSignatureContents({
    moves,
    speciesOf: (id) => SPECIES_OF.get(id),
    chainOf: (species) => CHAINS.get(species) as number,
    entityOf: (species) => ENTITIES.get(species) as Entity,
    typeName: () => 'Eléctrico',
    ...overrides,
  });
}

describe('learnerPokemonId', () => {
  it('lee el id de la URL del aprendiz', () => {
    expect(learnerPokemonId({ url: url('pokemon', 10080) })).toBe(10080);
  });
});

describe('pickMoveText', () => {
  it('toma el texto en español de la versión más reciente', () => {
    const text = pickMoveText([flavor('Viejo.', 3), flavor('Nuevo.', 18), flavor('Intermedio.', 9), flavor('English.', 25, 'en')]);
    expect(text).toBe('Nuevo.');
  });

  it('limpia saltos de línea', () => {
    expect(pickMoveText([flavor('Una línea\npartida.', 3)])).toBe('Una línea partida.');
  });

  it('devuelve undefined si no hay texto en español', () => {
    expect(pickMoveText([flavor('English only.', 3, 'en')])).toBeUndefined();
    expect(pickMoveText([])).toBeUndefined();
  });
});

describe('buildSignatureContents', () => {
  it('un movimiento de una sola especie es insignia de esa especie', () => {
    const { contents, moves } = build([move('sketch', [235])]);
    expect(moves).toBe(1);
    expect(contents).toHaveLength(1);
    expect(contents[0]).toEqual({
      id: 'signature-move-sketch-smeargle',
      kind: 'signature-move',
      entityId: 'smeargle',
      series: 'g2',
      payload: { name: 'Mov sketch', type: 'Eléctrico', description: 'Texto de sketch.', accepts: [] },
      verified: true,
    });
  });

  it('si lo aprenden varias especies de la línea, cada una lo recibe y las demás son respuestas válidas', () => {
    const { contents } = build([move('volt-tackle', [25, 26, 172])]);
    expect(contents.map((content) => content.entityId)).toEqual(['pichu', 'pikachu', 'raichu']);
    expect(contents.find((content) => content.entityId === 'pikachu')?.payload.accepts).toEqual(['pichu', 'raichu']);
    expect(contents.find((content) => content.entityId === 'pichu')?.payload.accepts).toEqual(['pikachu', 'raichu']);
    expect(contents.map((content) => content.series)).toEqual(['g2', 'g1', 'g1']);
  });

  it('una forma alternativa cuenta como su especie, sin repetir', () => {
    const { contents } = build([move('catastropika', [25, 10080])]);
    expect(contents.map((content) => content.entityId)).toEqual(['pikachu']);
  });

  it('un movimiento que aprenden dos líneas distintas no es insignia', () => {
    expect(build([move('tackle', [25, 133])]).contents).toEqual([]);
    // Ni siquiera si una de las dos solo lo aprende en una forma alternativa.
    expect(build([move('bite', [10080, 133])]).contents).toEqual([]);
  });

  it('un movimiento sin aprendices no aparece', () => {
    expect(build([move('shadow-rush', [])]).contents).toEqual([]);
  });

  it('un aprendiz de especie desconocida corta el script: podría romper la exclusividad', () => {
    expect(() => build([move('raro', [25, 99999])])).toThrow(/no se sabe a qué especie/);
  });

  it('enmascara el nombre de los aprendices en el texto', () => {
    const { contents } = build([
      move('volt-tackle', [25, 26, 172], { flavor_text_entries: [flavor('Pikachu y RAICHU lo usan; Pichu también.', 5)] }),
    ]);
    for (const content of contents) {
      expect(content.payload.description).toBe('??? y ??? lo usan; ??? también.');
    }
  });

  it('enmascara también los alias de los aprendices', () => {
    const { contents } = build([
      move('sketch', [235], { flavor_text_entries: [flavor('Lo usa Esmeargle.', 5)] }),
    ], { entityOf: () => entity('smeargle', 235, 'g2', ['Esmeargle']) });
    expect(contents[0].payload.description).toBe('Lo usa ???.');
  });

  it('si no hay texto en español, entra igual con nombre y tipo', () => {
    const result = build([move('sketch', [235], { flavor_text_entries: [flavor('English.', 5, 'en')] })]);
    expect(result.contents).toHaveLength(1);
    expect(result.contents[0].payload).not.toHaveProperty('description');
    expect(result.withoutText).toBe(1);
  });

  it('sin nombre en español, queda afuera y se informa', () => {
    const result = build([move('sketch', [235], { names: [{ name: 'Sketch', language: { name: 'en' } }] })]);
    expect(result.contents).toEqual([]);
    expect(result.excluded).toEqual([{ move: 'sketch', reason: 'no tiene nombre en español' }]);
  });

  it('si el nombre del movimiento contiene el de un aprendiz, queda afuera', () => {
    const result = build([
      move('pika-papow', [25], { names: [{ name: 'Pikachu Papow', language: { name: 'es' } }] }),
    ]);
    expect(result.contents).toEqual([]);
    expect(result.excluded[0]).toMatchObject({ move: 'pika-papow' });
  });

  it('una palabra que solo contiene el nombre no cuenta como fuga', () => {
    const result = build([move('catastropika', [25], { names: [{ name: 'Catastropika', language: { name: 'es' } }] })]);
    expect(result.contents).toHaveLength(1);
  });

  it('el orden de los datos no cambia el resultado', () => {
    const moves = [move('a-move', [235], { id: 2 }), move('volt-tackle', [25, 26], { id: 1 })];
    const forward = build(moves);
    const backward = build([...moves].reverse());
    expect(backward.contents).toEqual(forward.contents);
    expect(forward.contents.map((content) => content.id)).toEqual([
      'signature-move-volt-tackle-pikachu',
      'signature-move-volt-tackle-raichu',
      'signature-move-a-move-smeargle',
    ]);
  });

  it('todos los contenidos cumplen el esquema', () => {
    const { contents } = build([move('volt-tackle', [25, 26, 172]), move('sketch', [235])]);
    for (const content of contents) expect(contentSchema.safeParse(content).success, content.id).toBe(true);
  });
});
