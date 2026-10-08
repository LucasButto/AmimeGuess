// Moveset (sesión 07): 4 movimientos de cada Pokémon para el modo que los revela
// de a uno. Es lógica pura, sin red ni disco, para poder probarla sola
// (moveset.test.ts).
//
// Se eligen los 4 menos comunes de los que aprende el Pokémon: los que menos
// especies aprenden, así que son los que más lo delatan. No hay azar: el orden
// es "menos especies primero" y, si empatan, el de menor id de movimiento. Se
// presentan al revés, del más común al menos común, para que la primera pista
// sea la más vaga y la última la que más acerca a la respuesta.
//
// Todo sale de PokéAPI sin redactar nada (los nombres en español vienen tal cual),
// por eso `verified: true`.

import type { Content, Entity } from '../../../src/engine/types.ts';
import type { Move } from './schemas.ts';
import { leaksName, nameIn, nameVariants } from './transform.ts';

/** Cuántos movimientos tiene cada Moveset. */
export const MOVES_PER_POKEMON = 4;

export interface MovesetInput {
  /** Una entrada por Pokémon, con los movimientos (por nombre de la API) que aprende su forma por defecto. */
  pokemon: ReadonlyArray<{ entity: Entity; moves: readonly string[] }>;
  moves: readonly Move[];
  /** Cuántas especies aprenden cada movimiento, por nombre de la API. */
  learnerCount: ReadonlyMap<string, number>;
}

export interface MovesetResult {
  contents: Content[];
  /** Pokémon que no llegan a 4 movimientos que se puedan mostrar: quedan fuera del modo. */
  without: Array<{ id: string; usable: number }>;
}

interface Candidate {
  id: number;
  name: string;
  count: number;
}

export function buildMovesetContents({ pokemon, moves, learnerCount }: MovesetInput): MovesetResult {
  const info = new Map(moves.map((move) => [move.name, { id: move.id, spanish: nameIn(move.names, 'es') }]));
  const contents: Content[] = [];
  const without: MovesetResult['without'] = [];

  for (const { entity, moves: learned } of pokemon) {
    const names = nameVariants(
      [entity.name.es, entity.name.en, entity.id, ...entity.aliases].filter((name): name is string => name !== undefined),
    );

    // Los que se pueden mostrar: con nombre en español y sin el del Pokémon adentro. Sin repetidos.
    const seen = new Set<string>();
    const usable: Candidate[] = [];
    for (const slug of [...new Set(learned)]) {
      const move = info.get(slug);
      if (move === undefined) throw new Error(`${entity.id} aprende ${slug}, que no está en la lista de movimientos`);
      if (move.spanish === undefined || leaksName(move.spanish, names) || seen.has(move.spanish)) continue;
      seen.add(move.spanish);
      usable.push({ id: move.id, name: move.spanish, count: learnerCount.get(slug) ?? 0 });
    }

    if (usable.length < MOVES_PER_POKEMON) {
      without.push({ id: entity.id, usable: usable.length });
      continue;
    }

    const rarest = [...usable].sort((a, b) => a.count - b.count || a.id - b.id).slice(0, MOVES_PER_POKEMON);
    const items = rarest.sort((a, b) => b.count - a.count || a.id - b.id).map((move) => move.name);
    contents.push({
      id: `moveset-${entity.id}`,
      kind: 'moveset',
      entityId: entity.id,
      series: entity.series[0],
      payload: { items },
      verified: true,
    });
  }

  return { contents, without };
}
