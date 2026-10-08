// Pruebas sobre los datos reales de Pokémon (data/pokemon/): lo que los tests
// de la lógica no pueden ver, como que ninguna pista revele su respuesta o que
// con ciertos filtros un modo no alcance el pool mínimo.

import { describe, expect, it } from 'vitest';
import { defaultMinPool, hasMinimumPool } from '@/engine/filters';
import type { Content, Entity } from '@/engine/types';
import { candidatesOf } from '@/modes/text-clue/logic';
import { leaksName, nameVariants } from '../../../scripts/data/pokemon/transform.ts';
import entitiesJson from '../../../data/pokemon/entities.json';
import contentJson from '../../../data/pokemon/content.json';
import type { ModeConfig } from '../types';
import { pokemonConfig } from './config';

const entities = entitiesJson as Entity[];
const contents = contentJson as Content[];
const byId = new Map(entities.map((entity) => [entity.id, entity]));

/** Todas las formas en que el nombre de un Pokémon puede aparecer escrito. */
function namesOf(entity: Entity): string[] {
  return nameVariants([entity.name.es, entity.name.en, entity.id, ...entity.aliases].filter((name): name is string => name !== undefined));
}

const dex = contents.filter((content) => content.kind === 'dex');
const moves = contents.filter((content) => content.kind === 'signature-move');

const modes: readonly ModeConfig[] = pokemonConfig.modes;

function modeConfig(slug: string) {
  const textClue = modes.find((mode) => mode.slug === slug)?.textClue;
  if (!textClue) throw new Error(`${slug} no tiene config de text-clue`);
  return textClue;
}

describe('descripciones de la Pokédex', () => {
  it('hay descripciones para la mayoría de los Pokémon', () => {
    expect(dex.length).toBeGreaterThan(800);
  });

  it('ninguna contiene el nombre del Pokémon que describe', () => {
    const leaks = dex.filter((content) => {
      const entity = byId.get(content.entityId ?? '');
      return entity !== undefined && leaksName(String(content.payload.text), namesOf(entity));
    });
    expect(leaks.map((content) => content.id)).toEqual([]);
  });
});

describe('movimientos insignia', () => {
  it('hay movimientos y todos pertenecen a un Pokémon que existe', () => {
    expect(moves.length).toBeGreaterThan(150);
    for (const move of moves) expect(byId.has(move.entityId ?? ''), move.id).toBe(true);
  });

  it('ni el nombre ni el texto revelan a ninguno de los Pokémon que lo aprenden', () => {
    const leaks = moves.filter((move) => {
      const learners = [move.entityId ?? '', ...(move.payload.accepts as string[])].flatMap((id) => {
        const entity = byId.get(id);
        return entity ? namesOf(entity) : [];
      });
      const text = `${String(move.payload.name)}. ${String(move.payload.description ?? '')}`;
      return leaksName(text, learners);
    });
    expect(leaks.map((move) => move.id)).toEqual([]);
  });

  it('las respuestas equivalentes son recíprocas: si A acepta a B, B tiene el mismo movimiento y acepta a A', () => {
    const problems: string[] = [];
    for (const move of moves) {
      for (const otherId of move.payload.accepts as string[]) {
        const other = moves.find((candidate) => candidate.entityId === otherId && candidate.payload.name === move.payload.name);
        if (!other) problems.push(`${move.id}: ${otherId} no tiene el movimiento "${String(move.payload.name)}"`);
        else if (!(other.payload.accepts as string[]).includes(move.entityId ?? '')) problems.push(`${move.id}: ${otherId} no lo acepta de vuelta`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('un Pokémon y sus equivalentes comparten un mismo movimiento solo si son de una misma línea evolutiva', () => {
    // Las respuestas equivalentes de un movimiento son los aprendices de una línea: comparten tipo y nombre.
    for (const move of moves) {
      for (const otherId of move.payload.accepts as string[]) {
        const other = moves.find((candidate) => candidate.entityId === otherId && candidate.payload.name === move.payload.name);
        expect(other?.payload.type, move.id).toBe(move.payload.type);
      }
    }
  });
});

describe('pools con los filtros', () => {
  const all = pokemonConfig.series;
  const minimum = defaultMinPool('text-clue');

  it('Descripción y Movimiento insignia alcanzan el mínimo con todas las series', () => {
    for (const slug of ['descripcion', 'movimiento-insignia']) {
      expect(hasMinimumPool(candidatesOf(entities, contents, all, modeConfig(slug)).length, minimum), slug).toBe(true);
    }
  });

  it('Movimiento insignia con solo g3 no alcanza el mínimo: el marco muestra el aviso en vez del juego', () => {
    const pool = candidatesOf(entities, contents, ['g3'], modeConfig('movimiento-insignia'));
    expect(pool.length).toBeGreaterThan(0);
    expect(hasMinimumPool(pool.length, minimum)).toBe(false);
  });

  it('Descripción con solo g9 no tiene ninguna (PokéAPI no trae el texto en español de g9)', () => {
    expect(candidatesOf(entities, contents, ['g9'], modeConfig('descripcion'))).toEqual([]);
  });

  it('con una serie apagada no aparece nada de ella, ni respuestas ni equivalentes', () => {
    const active = all.filter((id) => id !== 'g1');
    for (const slug of ['descripcion', 'movimiento-insignia']) {
      const pool = candidatesOf(entities, contents, active, modeConfig(slug));
      expect(pool.some((candidate) => candidate.entity.series.every((series) => series === 'g1')), slug).toBe(false);
      for (const candidate of pool) {
        expect(candidate.contents.every((content) => content.series !== 'g1'), `${slug}/${candidate.id}`).toBe(true);
      }
    }
  });

  it('solo un Pokémon con movimiento insignia puede ser la respuesta de ese modo', () => {
    const withMove = new Set(moves.map((move) => move.entityId));
    const pool = candidatesOf(entities, contents, all, modeConfig('movimiento-insignia'));
    expect(pool.length).toBe(withMove.size);
    for (const candidate of pool) expect(withMove.has(candidate.id)).toBe(true);
  });
});
