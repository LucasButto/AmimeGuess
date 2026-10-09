// Esquemas Zod: lo que se espera de las fuentes, de los archivos curados de data-src/yugioh/ y lo
// que se escribe en data/yugioh/. Si algo no cumple, el script falla (SPEC sección 7).

import { z } from 'zod';

/**
 * Series en orden canónico (SPEC 3.1). `serieDebut` guarda la posición en esta lista (dm = 1), así sumar
 * zexal, arcv y vrains más adelante no cambia ningún número.
 */
export const SERIES = ['dm', 'gx', '5ds', 'zexal', 'arcv', 'vrains'] as const;
export type SeriesId = (typeof SERIES)[number];

export const ROLES = ['protagonista', 'rival', 'antagonista', 'aliado'] as const;
export const SUMMONING = ['normal', 'fusion', 'ritual', 'synchro', 'xyz', 'pendulum', 'link'] as const;
export type SummoningKind = (typeof SUMMONING)[number];

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const kebab = z.string().regex(KEBAB);
const seriesId = z.enum(SERIES);

// --- data-src/yugioh/ (curado a mano) ---------------------------------------

export const duelistSrcSchema = z
  .object({
    id: kebab,
    /** Nombre que se muestra. */
    name: z.string().min(1),
    aliases: z.array(z.string().min(1)),
    /** Series en las que duela, en orden canónico. La primera es la serie de debut. Cada una tiene que estar respaldada por su categoría de Fandom. */
    series: z.array(seriesId).min(1),
    /** Título de la página en Yu-Gi-Oh! Wiki de Fandom: de su categoría sale la serie. */
    fandom: z.string().min(1),
    /** Título de la página en Yugipedia, si no es el mismo. De ahí salen la infobox, las listas de deck y la imagen. */
    yugipedia: z.string().min(1).optional(),
    /** Otras páginas de Yugipedia donde buscar sus cartas (por ejemplo, el alter ego). Se agrega siempre "<página>'s Decks". */
    extraPages: z.array(z.string().min(1)).optional(),
    /** Archivo de imagen de Yugipedia (sin "File:") cuando la imagen principal de su página no sirve, por ejemplo si el recorte cuadrado deja afuera la cara. */
    imageFile: z.string().min(1).optional(),
    role: z.enum(ROLES),
    /** Valores de afiliación en español (escuela, dormitorio, organización, equipo). */
    affiliations: z.array(z.string().min(1)),
    /** Arquetipos o tipos de deck, en español. */
    decks: z.array(z.string().min(1)).min(1),
    verified: z.boolean(),
  })
  .strict();

const signatureCardSchema = z
  .object({
    /** Nombre oficial en inglés, tal como lo escribe YGOPRODeck. */
    name: z.string().min(1),
    /** 1 (menos icónica) a 3 (la más icónica): el modo Deck las revela de menor a mayor. */
    iconicity: z.number().int().min(1).max(3),
    /** La carta as del duelista: la que aparece en Carta insignia. Exactamente una por duelista. */
    ace: z.literal(true).optional(),
  })
  .strict();

export const signatureCardsSrcSchema = z
  .array(
    z
      .object({
        duelist: kebab,
        cards: z.array(signatureCardSchema).min(5).max(30),
        verified: z.boolean(),
      })
      .strict(),
  )
  .min(1);

export const summonSrcSchema = z
  .array(
    z
      .object({
        /** Monstruo de invocación especial, por su nombre en inglés. Tiene que ser una carta insignia. */
        card: z.string().min(1),
        kind: z.enum(['fusion', 'synchro', 'xyz', 'ritual']),
        /** Sus materiales por nombre en inglés, en el orden del texto de la carta; todos tienen que ser cartas insignia. */
        materials: z.array(z.string().min(1)).min(2),
        verified: z.boolean(),
      })
      .strict(),
  )
  .min(1);

const stringMap = z.record(z.string(), z.string().min(1));

export const translationsSchema = z
  .object({
    verified: z.boolean(),
    gender: stringMap,
    /** Nombre de cada serie, para "primera aparición". */
    series: z.record(seriesId, z.string().min(1)),
    summoning: z.record(z.enum(SUMMONING), z.string().min(1)),
    /** Tipo de carta de YGOPRODeck → clase en español y, para los monstruos, cómo se invoca. */
    cardType: z.record(
      z.string(),
      z.object({ class: z.string().min(1), summoning: z.enum(SUMMONING).optional() }).strict(),
    ),
    attribute: stringMap,
    spellTrapAttribute: stringMap,
    monsterType: stringMap,
    spellTrapType: stringMap,
  })
  .strict();

export type DuelistSrc = z.infer<typeof duelistSrcSchema>;
export type SignatureCardsSrc = z.infer<typeof signatureCardsSrcSchema>;
export type SummonSrc = z.infer<typeof summonSrcSchema>;
export type Translations = z.infer<typeof translationsSchema>;

// --- Fuentes (solo los campos que usa el script) ----------------------------

export const ygoprodeckCardSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  type: z.string(),
  desc: z.string(),
  race: z.string(),
  attribute: z.string().optional(),
  atk: z.number().optional(),
  def: z.number().optional(),
  level: z.number().optional(),
  linkval: z.number().optional(),
  archetype: z.string().optional(),
  card_images: z.array(z.object({ id: z.number().int(), image_url: z.string().url(), image_url_cropped: z.string().url() })).min(1),
  misc_info: z.array(z.object({ konami_id: z.number().int().optional() })).min(1),
});
export type YgoprodeckCard = z.infer<typeof ygoprodeckCardSchema>;

export const ygoprodeckResponseSchema = z.object({ data: z.array(ygoprodeckCardSchema) });

/** Respuesta de YGOResources: una entrada por idioma, con el nombre y el texto oficiales. */
export const ygoresourcesSchema = z.object({
  cardData: z.record(z.string(), z.object({ name: z.string(), effectText: z.string().optional() })),
});

/** Datos de un archivo de Yugipedia (`prop=imageinfo`): la URL y el tamaño. */
export const yugipediaFileSchema = z.object({
  query: z.object({
    pages: z.record(
      z.string(),
      z.object({ title: z.string(), imageinfo: z.array(z.object({ url: z.string().url(), width: z.number(), height: z.number() })).optional() }),
    ),
  }),
});

export const fandomCategorySchema = z.object({
  query: z.object({ categorymembers: z.array(z.object({ title: z.string() })) }),
  continue: z.object({ cmcontinue: z.string() }).optional(),
});

/** Páginas de Yugipedia (MediaWiki viejo): el contenido está en `revisions[0]['*']`. */
export const yugipediaPagesSchema = z.object({
  query: z.object({
    normalized: z.array(z.object({ from: z.string(), to: z.string() })).optional(),
    redirects: z.array(z.object({ from: z.string(), to: z.string() })).optional(),
    pages: z.record(
      z.string(),
      z.object({
        title: z.string(),
        missing: z.string().optional(),
        revisions: z.array(z.object({ '*': z.string() })).optional(),
        original: z.object({ source: z.string().url(), width: z.number(), height: z.number() }).optional(),
      }),
    ),
  }),
});

// --- Datos generados (data/yugioh/) -----------------------------------------

const attrValueSchema = z.union([
  z.string(),
  z.number(),
  z.null(),
  z.array(z.union([z.string(), z.object({ value: z.string(), series: z.string().optional() })])),
]);

const entityBase = {
  id: kebab,
  name: z.object({ es: z.string().min(1), en: z.string().min(1).optional() }),
  aliases: z.array(z.string().min(1)),
  image: z.string().min(1).optional(),
  attrs: z.record(z.string(), attrValueSchema),
  series: z.array(seriesId).min(1),
};

export const duelistEntitySchema = z.object({ ...entityBase, image: z.string().regex(/^yugioh\/duelists\/[a-z0-9]+(-[a-z0-9]+)*$/).optional() }).strict();
export const cardEntitySchema = z.object({ ...entityBase, image: z.string().regex(/^yugioh\/cards\/[a-z0-9]+(-[a-z0-9]+)*$/) }).strict();

const contentBase = { id: kebab, series: seriesId, verified: z.boolean() };

/** El texto de una carta con su nombre en "???". Un contenido por serie de la carta (regla 2 de la SPEC). */
const cardTextSchema = z
  .object({ ...contentBase, kind: z.literal('card-text'), entityId: kebab, payload: z.object({ text: z.string().min(1) }).strict() })
  .strict();

/** Las cartas insignia de un duelista, de menor a mayor iconicidad. La respuesta es el duelista. */
const deckSchema = z
  .object({
    ...contentBase,
    kind: z.literal('deck'),
    entityId: kebab,
    payload: z.object({ items: z.array(z.string().min(1)).min(5) }).strict(),
  })
  .strict();

/** Los materiales de un monstruo de invocación especial, en orden. La respuesta es el monstruo; cuentan también los que tienen los mismos materiales. */
const summonSchema = z
  .object({
    ...contentBase,
    kind: z.literal('summon'),
    entityId: kebab,
    payload: z.object({ kind: z.enum(['fusion', 'synchro', 'xyz', 'ritual']), items: z.array(z.string().min(1)).min(2), accepts: z.array(kebab) }).strict(),
  })
  .strict();

/** La carta as de un duelista, entera (con marco y texto): la imagen de Carta insignia. La respuesta es el duelista. */
const aceCardSchema = z
  .object({
    ...contentBase,
    kind: z.literal('ace-card'),
    entityId: kebab,
    payload: z
      .object({
        image: z.string().regex(/^yugioh\/cards-full\/[a-z0-9]+(-[a-z0-9]+)*$/),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        card: kebab,
      })
      .strict(),
  })
  .strict();

/** El monstruo de una carta recortado del fondo de su ilustración (WebP con transparencia): la imagen de Silueta. La respuesta es la carta. */
const silhouetteSchema = z
  .object({
    ...contentBase,
    kind: z.literal('silhouette'),
    entityId: kebab,
    payload: z.object({ image: z.string().regex(/^yugioh\/silhouettes\/[a-z0-9]+(-[a-z0-9]+)*$/) }).strict(),
  })
  .strict();

export const contentSchema = z.discriminatedUnion('kind', [cardTextSchema, deckSchema, summonSchema, aceCardSchema, silhouetteSchema]);

/**
 * data/yugioh/silhouettes.json: de cada monstruo, cuánto ocupa y cuán de una pieza es su recorte, y si sirvió para
 * Silueta. Es lo que evita volver a correr el modelo con cada corrida del script.
 */
export const silhouetteRecordsSchema = z
  .object({
    monsters: z.array(
      z.object({ id: kebab, coverage: z.number().min(0).max(1), connected: z.number().min(0).max(1), usable: z.boolean() }).strict(),
    ),
  })
  .strict();
export type SilhouetteRecord = z.infer<typeof silhouetteRecordsSchema>['monsters'][number];

export const seriesOutputSchema = z
  .object({ series: z.array(z.object({ id: seriesId, order: z.number().int().positive(), label: z.string().min(1) }).strict()) })
  .strict();
