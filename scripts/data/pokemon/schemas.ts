// Esquemas Zod: lo que se espera de PokéAPI y lo que se escribe en data/pokemon/.
// Si una respuesta o un dato generado no cumple, el script falla (SPEC sección 7).

import { z } from 'zod';

// --- PokéAPI (solo los campos que usa el script) ----------------------------

const named = z.object({ name: z.string(), url: z.string() });
const language = z.object({ name: z.string() });
const nameEntry = z.object({ name: z.string(), language });

export const speciesListSchema = z.object({
  count: z.number().int(),
  results: z.array(named),
});

export const speciesSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  names: z.array(nameEntry),
  generation: z.object({ name: z.string() }),
  color: named,
  habitat: named.nullable(),
  egg_groups: z.array(named),
  evolution_chain: z.object({ url: z.string() }),
  flavor_text_entries: z.array(z.object({ flavor_text: z.string(), language, version: named })),
  varieties: z.array(z.object({ is_default: z.boolean(), pokemon: named })),
});

export const pokemonSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  height: z.number().int(),
  weight: z.number().int(),
  types: z.array(z.object({ slot: z.number().int(), type: named })),
  abilities: z.array(z.object({ ability: named, is_hidden: z.boolean(), slot: z.number().int() })),
  /** Todos los movimientos que aprende, en cualquier juego. */
  moves: z.array(z.object({ move: named })),
  stats: z.array(z.object({ base_stat: z.number().int(), stat: z.object({ name: z.string() }) })),
  sprites: z.object({
    other: z
      .object({
        'official-artwork': z.object({ front_default: z.string().nullable() }).optional(),
      })
      .optional(),
  }),
});

export interface ChainLink {
  species: { name: string };
  evolves_to: ChainLink[];
}

const chainLinkSchema: z.ZodType<ChainLink> = z.lazy(() =>
  z.object({ species: z.object({ name: z.string() }), evolves_to: z.array(chainLinkSchema) }),
);

export const evolutionChainSchema = z.object({ id: z.number().int(), chain: chainLinkSchema });

/** Tipos, colores, hábitats, grupos huevo y habilidades: solo importan los nombres traducidos. */
export const namedResourceSchema = z.object({ names: z.array(nameEntry) });

export type Species = z.infer<typeof speciesSchema>;
export type PokemonData = z.infer<typeof pokemonSchema>;
export type NameEntry = z.infer<typeof nameEntry>;

// Movimientos: de cada uno interesa su nombre, su tipo, su texto y quién lo aprende.
export const moveListSchema = z.object({
  count: z.number().int(),
  results: z.array(named),
});

export const moveSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  names: z.array(nameEntry),
  type: named,
  flavor_text_entries: z.array(z.object({ flavor_text: z.string(), language, version_group: named })),
  learned_by_pokemon: z.array(named),
});

/** Una forma alternativa (Mega, regional, Gigamax…): solo importa a qué especie pertenece. */
export const pokemonSpeciesRefSchema = z.object({
  id: z.number().int(),
  species: named,
});

export type Move = z.infer<typeof moveSchema>;

// --- TCGdex (solo los campos que usa el script) -----------------------------

/** Una carta en el listado de `cards?dexId=eq:N`: sin detalle, y sin imagen si no hay escaneo. */
export const tcgCardBriefSchema = z.object({
  id: z.string().min(1),
  localId: z.string().min(1),
  name: z.string(),
  image: z.string().optional(),
});

export const tcgCardListSchema = z.array(tcgCardBriefSchema);

export const tcgCardSchema = z.object({
  id: z.string().min(1),
  localId: z.string().min(1),
  name: z.string(),
  category: z.string(),
  image: z.string().optional(),
  /** Números de Pokédex nacional de los Pokémon que aparecen en la carta. */
  dexId: z.array(z.number().int()).optional(),
  set: z.object({ id: z.string().min(1), name: z.string() }),
});

export type TcgCardBrief = z.infer<typeof tcgCardBriefSchema>;
export type TcgCard = z.infer<typeof tcgCardSchema>;

// --- Datos generados --------------------------------------------------------

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SERIES = /^g[1-9]$/;

const attrValueSchema = z.union([
  z.string(),
  z.number(),
  z.null(),
  z.array(z.union([z.string(), z.object({ value: z.string(), series: z.string().optional() })])),
]);

export const entitySchema = z
  .object({
    id: z.string().regex(KEBAB),
    name: z.object({ es: z.string().min(1), en: z.string().min(1).optional() }),
    aliases: z.array(z.string().min(1)),
    series: z.array(z.string().regex(SERIES)).length(1),
    image: z.string().min(1).optional(),
    attrs: z.record(z.string(), attrValueSchema),
  })
  .strict();

const contentBase = {
  id: z.string().regex(KEBAB),
  entityId: z.string().regex(KEBAB),
  series: z.string().regex(SERIES),
  verified: z.boolean(),
};

const dexContentSchema = z
  .object({
    ...contentBase,
    kind: z.literal('dex'),
    payload: z.object({ text: z.string().min(1), version: z.string().min(1) }).strict(),
  })
  .strict();

/** Una carta del TCG: `image` es la ruta sin tamaño ni extensión; `width` y `height`, las del archivo de 512 px. */
const tcgCardContentSchema = z
  .object({
    ...contentBase,
    kind: z.literal('tcg-card'),
    payload: z
      .object({
        image: z.string().regex(/^pokemon\/cards\/[a-z0-9]+(-[a-z0-9]+)*$/),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        cardId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

/**
 * Un movimiento que solo aprende una línea evolutiva, atado a uno de sus aprendices.
 * `accepts` son los otros aprendices de la línea: también son respuestas correctas.
 */
const signatureMoveContentSchema = z
  .object({
    ...contentBase,
    kind: z.literal('signature-move'),
    payload: z
      .object({
        name: z.string().min(1),
        type: z.string().min(1),
        description: z.string().min(1).optional(),
        accepts: z.array(z.string().regex(KEBAB)),
      })
      .strict(),
  })
  .strict();

/** Los 4 movimientos del Moveset, del más común al menos común: el último es el que más delata al Pokémon. */
const movesetContentSchema = z
  .object({
    ...contentBase,
    kind: z.literal('moveset'),
    payload: z.object({ items: z.array(z.string().min(1)).length(4) }).strict(),
  })
  .strict();

export const contentSchema = z.discriminatedUnion('kind', [
  dexContentSchema,
  tcgCardContentSchema,
  signatureMoveContentSchema,
  movesetContentSchema,
]);
