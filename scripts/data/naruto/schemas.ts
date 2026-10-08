// Esquemas Zod: lo que se espera de las fuentes, de los archivos curados de
// data-src/naruto/ y lo que se escribe en data/naruto/. Si algo no cumple, el
// script falla (SPEC sección 7).

import { z } from 'zod';

/** Series en orden canónico (SPEC 3.1). También es el orden cronológico de la historia. */
export const SERIES = ['naruto', 'shippuden', 'boruto'] as const;
export type SeriesId = (typeof SERIES)[number];

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const kebab = z.string().regex(KEBAB);
const seriesId = z.enum(SERIES);

export const STATUSES = ['Vivo', 'Muerto', 'Incapacitado'] as const;
export const GENDERS = ['Masculino', 'Femenino'] as const;

// --- Dattebayo API (solo los campos que usa el script) ----------------------

const textOrList = z.union([z.string(), z.array(z.string())]);

export const apiCharacterSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  images: z.array(z.string()).optional(),
  debut: z.object({ manga: z.string().optional(), anime: z.string().optional() }).optional(),
  jutsu: z.array(z.string()).optional(),
  natureType: z.array(z.string()).optional(),
  personal: z
    .object({
      sex: z.string().optional(),
      status: z.string().optional(),
      kekkeiGenkai: textOrList.optional(),
      classification: textOrList.optional(),
      occupation: textOrList.optional(),
      affiliation: textOrList.optional(),
      team: textOrList.optional(),
    })
    .optional(),
});

/** Una página de una lista de Dattebayo con miembros por id (equipos, clanes, kekkei genkai, aldeas). */
export function apiGroupListSchema<K extends string>(key: K) {
  return z.object({
    [key]: z.array(z.object({ id: z.number().int(), name: z.string(), characters: z.array(z.number().int()) })),
    currentPage: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
  }) as unknown as z.ZodType<{
    [P in K]: Array<{ id: number; name: string; characters: number[] }>;
  } & { currentPage: number; pageSize: number; total: number }>;
}

/** Akatsuki y Kara llegan como listas de personajes completos; solo hace falta quiénes son. */
export function apiMemberListSchema<K extends string>(key: K) {
  return z.object({
    [key]: z.array(z.object({ id: z.number().int(), name: z.string() })),
    currentPage: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
  }) as unknown as z.ZodType<{ [P in K]: Array<{ id: number; name: string }> } & { currentPage: number; pageSize: number; total: number }>;
}

export type ApiCharacter = z.infer<typeof apiCharacterSchema>;

// --- API MediaWiki de Narutopedia -------------------------------------------

export const wikiPagesSchema = z.object({
  query: z.object({
    normalized: z.array(z.object({ from: z.string(), to: z.string() })).optional(),
    redirects: z.array(z.object({ from: z.string(), to: z.string() })).optional(),
    pages: z.array(
      z.object({
        title: z.string(),
        missing: z.boolean().optional(),
        revisions: z.array(z.object({ slots: z.object({ main: z.object({ content: z.string() }) }) })).optional(),
      }),
    ),
  }),
});

// --- data-src/naruto/ (curado a mano) ---------------------------------------

/**
 * Los arcos de cada serie. `from` es el primer episodio del anime del arco (Narutopedia, página de cada
 * arco): un episodio pertenece al arco que empezó más recientemente, así los episodios de relleno
 * entre dos arcos quedan en el anterior. De acá sale "Arco de debut" del Clásico.
 */
export const arcsFileSchema = z
  .array(z.object({ id: kebab, name: z.string().min(1), series: seriesId, from: z.number().int().positive() }).strict())
  .min(1);

const spanishList = z.array(z.string().min(1));

/** Lo que se puede forzar a mano cuando la API no tiene el dato o está mal. Reemplaza el valor calculado. */
const overrideSchema = z
  .object({
    genero: z.enum(GENDERS).nullable(),
    estadoVital: z.enum(STATUSES),
    ocupacion: z.string().min(1).nullable(),
    afiliaciones: spanishList,
    tiposDeJutsu: spanishList,
    kekkeiGenkai: spanishList,
    naturalezas: spanishList,
    atributos: spanishList,
  })
  .partial()
  .strict();

export const characterSrcSchema = z
  .object({
    id: kebab,
    /** Nombre que se muestra. */
    name: z.string().min(1),
    aliases: z.array(z.string().min(1)),
    /** Id en Dattebayo API y el nombre que tenía al curar: si cambia, el build falla y hay que revisar. */
    api: z.number().int().positive(),
    apiName: z.string().min(1),
    /** Título de la página en Narutopedia, si no es el nombre de Dattebayo: de ahí sale la imagen. */
    wiki: z.string().min(1).optional(),
    /** Series en las que aparece, en orden canónico. La primera es la serie de debut y tiene que coincidir con `debut.anime` de Dattebayo. */
    series: z.array(seriesId).min(1),
    /** Arco de debut: solo si el personaje no tiene episodio de anime en Dattebayo (el resto se calcula con arcs.json). */
    arcDebut: kebab.optional(),
    override: overrideSchema.optional(),
    verified: z.boolean(),
  })
  .strict();

/**
 * Diccionario inglés → español de los valores de atributos de Dattebayo y Narutopedia. Todo está
 * sin verificar. Un valor con `null` se ignora a propósito; un valor que no está acá hace fallar el build.
 */
const dictionary = z.record(z.string(), z.string().min(1).nullable());

export const translationsSchema = z
  .object({
    verified: z.boolean(),
    sex: z.record(z.string(), z.enum(GENDERS).nullable()),
    status: z.record(z.string(), z.enum(STATUSES).nullable()),
    affiliation: dictionary,
    classification: dictionary,
    occupation: dictionary,
    kekkeiGenkai: dictionary,
    natureType: dictionary,
    jutsuType: dictionary,
    /** Valores de afiliación (en español) que solo se ven desde cierta serie (regla 3 de la SPEC). */
    affiliationSeries: z.record(z.string(), seriesId),
  })
  .strict();

export const quoteSrcSchema = z
  .object({
    id: kebab,
    character: kebab,
    /** La frase en español. */
    text: z.string().min(1),
    /** A quién se la dijo, tal como se lo muestra de pista. `null` si no iba dirigida a nadie. */
    addressee: z.string().min(1).nullable(),
    /** Arco en que la dijo (id de arcs.json). */
    arc: kebab,
    series: seriesId,
    /** Otros personajes que también dijeron la frase (o una igual): cuentan como acierto. */
    accepts: z.array(kebab).optional(),
    /** Página de Narutopedia donde figura (créditos CC BY-SA). Por defecto, la del personaje. */
    source: z.string().url().optional(),
    /** Cómo se comprobó que existe, con el original en inglés; solo para quien revisa, no se publica. */
    context: z.string().min(1).optional(),
    verified: z.boolean(),
  })
  .strict();

export const jutsuSrcSchema = z
  .object({
    id: kebab,
    /** Nombre que se muestra. */
    name: z.string().min(1),
    /** Título de la página en Narutopedia: de ahí salen la imagen y la clasificación. */
    wiki: z.string().min(1),
    /** Quién es la respuesta. También cuentan como acierto los demás personajes del juego que figuran como usuarios en la infobox de la página (sin marca de juego, película o anime). */
    answer: kebab,
    /** Serie en la que se ve la imagen; si no está, es la del primer episodio del anime que dice la infobox de la página. */
    series: seriesId.optional(),
    verified: z.boolean(),
  })
  .strict();

export const teamSrcSchema = z
  .object({
    id: kebab,
    name: z.string().min(1),
    /** Los miembros en el orden en que se muestran. */
    members: z.array(kebab).min(3),
    /** Cuáles de ellos pueden ser el miembro que falta; si no está, cualquiera. */
    answers: z.array(kebab).min(1).optional(),
    series: seriesId,
    /** Nombre del equipo en Dattebayo, si existe: el build comprueba que sus miembros son también de ese equipo. */
    api: z.string().min(1).optional(),
    verified: z.boolean(),
  })
  .strict();

/** Solo emojis y los espacios entre ellos (con sus selectores de variación y uniones de secuencia). */
const EMOJI_ONLY = new RegExp(String.raw`^[\p{Extended_Pictographic}${String.fromCharCode(0x200d, 0xfe0f)} ]+$`, 'u');

export const emojiSrcSchema = z
  .object({
    id: kebab,
    /** Quién o qué se describe: un personaje o un arco (id de arcs.json). */
    character: kebab.optional(),
    arc: kebab.optional(),
    /** Solo emojis (y los espacios entre ellos). */
    text: z.string().regex(EMOJI_ONLY),
    series: seriesId,
    verified: z.boolean(),
  })
  .strict()
  .refine((item) => (item.character === undefined) !== (item.arc === undefined), {
    message: 'Una entrada describe a un personaje o a un arco, no a los dos',
  });

const DERIVED_KINDS = ['clan', 'village', 'akatsuki', 'kara', 'kekkei-genkai', 'classification'] as const;

export const groupSrcSchema = z
  .object({
    id: kebab,
    name: z.string().min(1),
    /** Qué clase de grupo es (clan, aldea, organización, invocación…). Es una etiqueta; no la usa la lógica. */
    category: z.string().min(1),
    /** 1 (fácil) a 4 (difícil). Un tablero lleva un grupo de cada dificultad. */
    difficulty: z.number().int().min(1).max(4),
    series: seriesId,
    /** TODOS los personajes de data-src/naruto/characters.json que pertenecen al grupo, no solo los que se muestran. */
    members: z.array(kebab).min(4),
    /** De dónde sale la lista, si una fuente la tiene: el build comprueba que `members` coincide con ella. */
    derived: z
      .object({
        from: z.enum(DERIVED_KINDS),
        name: z.string().min(1).optional(),
        /** Excepciones a propósito: personajes que la fuente incluye y el grupo no, o al revés. */
        exclude: z.array(kebab).optional(),
        include: z.array(kebab).optional(),
      })
      .strict()
      .optional(),
    verified: z.boolean(),
  })
  .strict();

/** Punto focal del ojo: va por personaje y solo cuenta si el personaje tiene imagen. */
export const focusSrcSchema = z
  .array(
    z
      .object({
        character: kebab,
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
        verified: z.boolean(),
      })
      .strict(),
  );

export type ArcsFile = z.infer<typeof arcsFileSchema>;
export type CharacterSrc = z.infer<typeof characterSrcSchema>;
export type Translations = z.infer<typeof translationsSchema>;
export type QuoteSrc = z.infer<typeof quoteSrcSchema>;
export type JutsuSrc = z.infer<typeof jutsuSrcSchema>;
export type TeamSrc = z.infer<typeof teamSrcSchema>;
export type EmojiSrc = z.infer<typeof emojiSrcSchema>;
export type GroupSrc = z.infer<typeof groupSrcSchema>;
export type FocusSrc = z.infer<typeof focusSrcSchema>;

// --- Datos generados (data/naruto/) -----------------------------------------

const attrValueSchema = z.union([
  z.string(),
  z.number(),
  z.null(),
  z.array(z.union([z.string(), z.object({ value: z.string(), series: z.string().optional() })])),
]);

export const characterEntitySchema = z
  .object({
    id: kebab,
    name: z.object({ es: z.string().min(1), en: z.string().min(1).optional() }),
    aliases: z.array(z.string().min(1)),
    image: z.string().min(1).optional(),
    attrs: z.record(z.string(), attrValueSchema),
    series: z.array(seriesId).min(1),
  })
  .strict();

const contentBase = { id: kebab, series: seriesId, verified: z.boolean() };

const quoteContentSchema = z
  .object({
    ...contentBase,
    kind: z.literal('quote'),
    entityId: kebab,
    payload: z
      .object({
        text: z.string().min(1),
        source: z.string().url(),
        addressee: z.string().min(1).optional(),
        arc: z.string().min(1),
        accepts: z.array(kebab).optional(),
      })
      .strict(),
  })
  .strict();

const jutsuContentSchema = z
  .object({
    ...contentBase,
    kind: z.literal('jutsu'),
    entityId: kebab,
    payload: z
      .object({
        name: z.string().min(1),
        image: z.string().regex(/^naruto\/jutsus\/[a-z0-9]+(-[a-z0-9]+)*$/),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        accepts: z.array(kebab),
      })
      .strict(),
  })
  .strict();

/** Un equipo con un miembro que falta: `items` son los demás, en el orden en que se revelan. */
const teamContentSchema = z
  .object({
    ...contentBase,
    kind: z.literal('team'),
    entityId: kebab,
    payload: z.object({ team: z.string().min(1), items: z.array(z.string().min(1)).min(2), accepts: z.array(kebab) }).strict(),
  })
  .strict();

const emojiContentSchema = z
  .object({
    ...contentBase,
    kind: z.literal('emoji'),
    entityId: kebab,
    payload: z.object({ text: z.string().min(1) }).strict(),
  })
  .strict();

/** Un arco descrito con emojis. Todavía ningún modo lo usa: no tiene una entidad que sea la respuesta. */
const emojiArcContentSchema = z
  .object({
    ...contentBase,
    kind: z.literal('emoji-arc'),
    payload: z.object({ arc: kebab, text: z.string().min(1) }).strict(),
  })
  .strict();

/** El ojo de un personaje: la imagen del personaje con el punto que abre el zoom. */
const eyeContentSchema = z
  .object({
    ...contentBase,
    kind: z.literal('eye'),
    entityId: kebab,
    payload: z
      .object({
        image: z.string().regex(/^naruto\/[a-z0-9]+(-[a-z0-9]+)*$/),
        width: z.literal(512),
        height: z.literal(512),
        focus: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict(),
      })
      .strict(),
  })
  .strict();

/** Un grupo para Conexiones. `shared` marca a los miembros que están en más de un grupo, con los otros grupos. */
const groupContentSchema = z
  .object({
    ...contentBase,
    kind: z.literal('group'),
    payload: z
      .object({
        name: z.string().min(1),
        category: z.string().min(1),
        difficulty: z.number().int().min(1).max(4),
        members: z.array(kebab).min(4),
        shared: z.record(kebab, z.array(kebab).min(1)),
      })
      .strict(),
  })
  .strict();

export const contentSchema = z.discriminatedUnion('kind', [
  quoteContentSchema,
  jutsuContentSchema,
  teamContentSchema,
  emojiContentSchema,
  emojiArcContentSchema,
  eyeContentSchema,
  groupContentSchema,
]);

export const arcsOutputSchema = z
  .object({
    series: z.array(z.object({ id: seriesId, order: z.number().int().positive() }).strict()),
    arcs: z.array(z.object({ id: kebab, name: z.string().min(1), series: seriesId, order: z.number().int().positive() }).strict()),
  })
  .strict();
