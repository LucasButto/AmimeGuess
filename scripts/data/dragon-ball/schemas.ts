// Esquemas Zod: lo que se espera de las APIs, de los archivos curados de
// data-src/dragon-ball/ y lo que se escribe en data/dragon-ball/. Si algo no
// cumple, el script falla (SPEC sección 7).

import { z } from 'zod';

/** Series en orden canónico (SPEC 3.1). Es el orden de emisión: db, dbz, gt, super, daima. */
export const SERIES = ['db', 'dbz', 'gt', 'super', 'daima'] as const;
export type SeriesId = (typeof SERIES)[number];

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const kebab = z.string().regex(KEBAB);
const seriesId = z.enum(SERIES);

// --- Dragon Ball API (solo los campos que usa el script) --------------------

export const apiCharacterSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  image: z.string().url(),
});

export const apiCharacterListSchema = z.object({
  items: z.array(apiCharacterSchema),
  meta: z.object({ totalItems: z.number().int(), totalPages: z.number().int() }),
});

export const apiTransformationSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  image: z.string().url(),
});

/** Las transformaciones llegan como una lista sin paginar. */
export const apiTransformationListSchema = z.array(apiTransformationSchema);

export type ApiCharacter = z.infer<typeof apiCharacterSchema>;
export type ApiTransformation = z.infer<typeof apiTransformationSchema>;

// --- API MediaWiki de la wiki en español ------------------------------------

export const wikiCategoryMembersSchema = z.object({
  continue: z.object({ cmcontinue: z.string() }).optional(),
  query: z.object({ categorymembers: z.array(z.object({ title: z.string() })) }),
});

// --- data-src/dragon-ball/ (curado a mano) ----------------------------------

/**
 * Orden cronológico de la historia (no el de emisión) y las sagas de cada serie,
 * en el orden en que ocurren dentro de su serie. De acá salen los números de
 * "Serie de debut" y "Saga de debut" del Clásico y el orden de la línea de tiempo.
 */
export const sagasFileSchema = z
  .object({
    seriesOrder: z.array(seriesId).length(SERIES.length),
    sagas: z.array(z.object({ id: kebab, series: seriesId, name: z.string().min(1) }).strict()).min(1),
  })
  .strict();

const seriesLabeled = z.object({ value: z.string().min(1), series: seriesId }).strict();

export const characterSrcSchema = z
  .object({
    id: kebab,
    /** Nombre que se muestra, el del doblaje latino. */
    name: z.string().min(1),
    aliases: z.array(z.string().min(1)),
    /** Id en Dragon Ball API: de ahí sale la imagen (transparente). */
    api: z.number().int().positive().optional(),
    /** Título de la página en la wiki en español: sus categorías dicen en qué series aparece. */
    wiki: z.string().min(1),
    genero: z.string().min(1),
    razas: z.array(z.string().min(1)),
    afiliaciones: z.array(z.string().min(1)),
    planeta: z.string().min(1).nullable(),
    transformaciones: z.array(seriesLabeled),
    sagaDebut: kebab,
    estadoVital: z.enum(['Vivo', 'Muerto', 'Desconocido']),
    /** Técnica característica, para la pista del Clásico. */
    tecnica: z.string().min(1).nullable(),
    /** La imagen de la API no sirve (no es el personaje): queda sin imagen hasta cargar otra a mano. */
    sinImagen: z.boolean().optional(),
    verified: z.boolean(),
  })
  .strict();

export const transformationSrcSchema = z
  .object({
    id: kebab,
    api: z.number().int().positive(),
    /** Id del personaje que la usa. */
    character: kebab,
    /** Nombre de la forma sin el personaje: es el valor que aparece en `transformaciones` del personaje. */
    forma: z.string().min(1),
    /** Nombre completo, el que se adivina. */
    name: z.string().min(1),
    aliases: z.array(z.string().min(1)),
    series: seriesId,
    verified: z.boolean(),
  })
  .strict();

export const techniqueSrcSchema = z
  .object({
    id: kebab,
    name: z.string().min(1),
    /** El primero es la respuesta; los demás también cuentan como acierto. */
    users: z.array(kebab).min(1),
    /** Serie en la que se ve la imagen. */
    series: seriesId,
    verified: z.boolean(),
  })
  .strict();

export const quoteSrcSchema = z
  .object({
    id: kebab,
    character: kebab,
    text: z.string().min(1),
    series: seriesId,
    /** Página de la wiki de la que se copió: va a la página de créditos (CC BY-SA). */
    source: z.string().url(),
    /** A quién se la dijo y cuándo, tal como lo anota la wiki. Solo para quien revisa; no se publica. */
    context: z.string().min(1).optional(),
    verified: z.boolean(),
  })
  .strict();

export const eventSrcSchema = z
  .object({
    id: kebab,
    text: z.string().min(1),
    series: seriesId,
    /** Posición dentro de su serie, desde 1, sin repetir. El orden entre series lo da `seriesOrder`. */
    order: z.number().int().positive(),
    verified: z.boolean(),
  })
  .strict();

export const powerSrcSchema = z
  .object({
    /** Id del personaje. */
    id: kebab,
    /** Ki máximo; `null` si es desconocido o no se puede comparar. */
    ki: z.number().positive().finite().nullable(),
    /** `true` solo si el valor figura en una fuente oficial (manga o guías) citada en `source`. */
    official: z.boolean(),
    source: z.string().min(1),
  })
  .strict();

export type SagasFile = z.infer<typeof sagasFileSchema>;
export type CharacterSrc = z.infer<typeof characterSrcSchema>;
export type TransformationSrc = z.infer<typeof transformationSrcSchema>;
export type TechniqueSrc = z.infer<typeof techniqueSrcSchema>;
export type QuoteSrc = z.infer<typeof quoteSrcSchema>;
export type EventSrc = z.infer<typeof eventSrcSchema>;
export type PowerSrc = z.infer<typeof powerSrcSchema>;

// --- Datos generados (data/dragon-ball/) ------------------------------------

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
};

/** Un personaje: aparece en una o más series, en orden canónico. */
export const characterEntitySchema = z
  .object({ ...entityBase, series: z.array(seriesId).min(1) })
  .strict();

/** Una forma: pertenece a una sola serie. */
export const transformationEntitySchema = z
  .object({ ...entityBase, series: z.array(seriesId).length(1) })
  .strict();

const contentBase = { id: kebab, series: seriesId, verified: z.boolean() };

const quoteContentSchema = z
  .object({
    ...contentBase,
    kind: z.literal('quote'),
    entityId: kebab,
    payload: z.object({ text: z.string().min(1), source: z.string().url() }).strict(),
  })
  .strict();

/** Un suceso para la línea de tiempo. `order` es el lugar en la cronología de toda la franquicia, desde 1. */
const eventContentSchema = z
  .object({
    ...contentBase,
    kind: z.literal('event'),
    payload: z.object({ text: z.string().min(1), order: z.number().int().positive() }).strict(),
  })
  .strict();

/**
 * La imagen de una técnica: `image` es la ruta sin tamaño ni extensión; `width` y `height`, las del archivo
 * de 512 px. La respuesta es `entityId`; `accepts` son los otros que la usan.
 */
const techniqueContentSchema = z
  .object({
    ...contentBase,
    kind: z.literal('technique'),
    entityId: kebab,
    payload: z
      .object({
        name: z.string().min(1),
        image: z.string().regex(/^dragon-ball\/techniques\/[a-z0-9]+(-[a-z0-9]+)*$/),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        accepts: z.array(kebab),
      })
      .strict(),
  })
  .strict();

export const contentSchema = z.discriminatedUnion('kind', [
  quoteContentSchema,
  eventContentSchema,
  techniqueContentSchema,
]);

/** Las series y las sagas con su lugar en la cronología (desde 1): lo que hace falta para mostrar "Serie de debut" y "Saga de debut". */
export const sagasOutputSchema = z
  .object({
    series: z.array(z.object({ id: seriesId, order: z.number().int().positive() }).strict()),
    sagas: z.array(
      z.object({ id: kebab, name: z.string().min(1), series: seriesId, order: z.number().int().positive() }).strict(),
    ),
  })
  .strict();
