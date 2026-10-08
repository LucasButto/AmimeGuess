// Movimientos insignia (sesión 06): los que solo aprende una línea evolutiva.
// Es lógica pura, sin red ni disco, para poder probarla sola (moves.test.ts).
//
// Un movimiento es insignia si todos sus aprendices (incluidas sus formas
// Mega, regionales o Gigamax) pertenecen a una misma cadena evolutiva. Cada
// aprendiz recibe el movimiento como contenido `signature-move`; los demás
// aprendices de la línea quedan en `accepts`, porque también son respuestas
// correctas ("Placaje Eléctrico" lo aprenden Pichu, Pikachu y Raichu).
//
// Todo sale de PokéAPI sin redactar nada: nombre, tipo y texto vienen tal cual
// en español, por eso `verified: true`. Lo único que se agrega es enmascarar con
// "???" el nombre de los aprendices dentro del texto.

import type { Content, Entity } from '../../../src/engine/types.ts';
import type { Move } from './schemas.ts';
import { cleanFlavorText, leaksName, maskName, nameIn, nameVariants } from './transform.ts';

function idFromUrl(url: string): number {
  return Number(url.split('/').filter(Boolean).pop());
}

/** Id del Pokémon (o de su forma) que aparece en la lista de aprendices de un movimiento. */
export function learnerPokemonId(learner: { url: string }): number {
  return idFromUrl(learner.url);
}

/**
 * El texto en español de la versión más reciente que lo tiene (mayor id de
 * grupo de versiones en PokéAPI). Devuelve `undefined` si no hay ninguno.
 */
export function pickMoveText(entries: Move['flavor_text_entries']): string | undefined {
  let best: { id: number; text: string } | undefined;
  for (const entry of entries) {
    if (entry.language.name !== 'es') continue;
    const text = cleanFlavorText(entry.flavor_text);
    if (text.length === 0) continue;
    const id = idFromUrl(entry.version_group.url);
    if (best === undefined || id > best.id) best = { id, text };
  }
  return best?.text;
}

export interface SignatureInput {
  moves: readonly Move[];
  /** Especie de un Pokémon de la API, sea la forma por defecto o una alternativa. `undefined` si no se conoce. */
  speciesOf: (pokemonId: number) => number | undefined;
  /** Cadena evolutiva de una especie. */
  chainOf: (speciesId: number) => number;
  /** La entidad de una especie (el número de Pokédex nacional es el id de la especie). */
  entityOf: (speciesId: number) => Entity;
  /** Nombre en español de un tipo, por URL. */
  typeName: (url: string) => string;
}

/** Un movimiento que no entró, y por qué: para el informe. */
export interface Excluded {
  move: string;
  reason: string;
}

export interface SignatureResult {
  contents: Content[];
  /** Movimientos exclusivos de una línea que quedaron afuera. */
  excluded: Excluded[];
  /** Movimientos exclusivos de una línea que entraron. */
  moves: number;
  /** De esos, los que no tienen texto en español: se juegan solo con nombre y tipo. */
  withoutText: number;
}

export function buildSignatureContents({ moves, speciesOf, chainOf, entityOf, typeName }: SignatureInput): SignatureResult {
  const contents: Content[] = [];
  const excluded: Excluded[] = [];
  let entered = 0;
  let withoutText = 0;

  for (const move of [...moves].sort((a, b) => a.id - b.id)) {
    // Aprendices como especies, sin repetidos. Uno que no se sabe de qué especie es podría ser de otra
    // línea y romper la exclusividad: no se puede ignorar.
    const learnerIds = new Set<number>();
    for (const learner of move.learned_by_pokemon) {
      const speciesId = speciesOf(learnerPokemonId(learner));
      if (speciesId === undefined) {
        throw new Error(`${move.name}: no se sabe a qué especie pertenece el aprendiz ${learner.name}`);
      }
      learnerIds.add(speciesId);
    }
    if (learnerIds.size === 0) continue;

    const chains = new Set([...learnerIds].map(chainOf));
    if (chains.size !== 1) continue;

    const learners = [...learnerIds].map(entityOf).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const spanishName = nameIn(move.names, 'es');
    if (spanishName === undefined) {
      excluded.push({ move: move.name, reason: 'no tiene nombre en español' });
      continue;
    }

    const names = nameVariants(
      learners.flatMap((entity) => [entity.name.es, entity.name.en, entity.id, ...entity.aliases]).filter((name): name is string => name !== undefined),
    );
    if (leaksName(spanishName, names)) {
      excluded.push({ move: move.name, reason: `el nombre "${spanishName}" contiene el de un aprendiz` });
      continue;
    }

    const rawText = pickMoveText(move.flavor_text_entries);
    const description = rawText === undefined ? undefined : maskName(rawText, names);
    if (description !== undefined && leaksName(description, names)) {
      throw new Error(`La descripción de ${move.name} sigue conteniendo el nombre de un aprendiz: ${description}`);
    }

    entered++;
    if (description === undefined) withoutText++;
    for (const entity of learners) {
      contents.push({
        id: `signature-move-${move.name}-${entity.id}`,
        kind: 'signature-move',
        entityId: entity.id,
        series: entity.series[0],
        payload: {
          name: spanishName,
          type: typeName(move.type.url),
          ...(description === undefined ? {} : { description }),
          accepts: learners.filter((other) => other.id !== entity.id).map((other) => other.id),
        },
        verified: true,
      });
    }
  }

  return { contents, excluded, moves: entered, withoutText };
}
