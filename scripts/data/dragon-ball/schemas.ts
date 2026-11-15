// Esquemas Zod: lo que se espera de las APIs, de los archivos curados de
// data/dragon-ball/source/ y lo que se escribe en data/dragon-ball/. Si algo no
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

export type ApiCharacter = z.infer<typeof apiCharacterSchema>;

// --- API MediaWiki de la wiki en español ------------------------------------

export const wikiCategoryMembersSchema = z.object({
  continue: z.object({ cmcontinue: z.string() }).optional(),
  query: z.object({ categorymembers: z.array(z.object({ title: z.string() })) }),
});

// --- data/dragon-ball/source/ (curado a mano) ----------------------------------

/**
 * `seriesOrder` conserva el orden de filtros y de las series de la línea de tiempo.
 * El arreglo `sagas` define el orden global de la historia para "Saga de debut",
 * aunque una saga pertenezca a una serie anterior (el final de Z tras Super).
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
    /** Título de la página en la wiki en español: sus categorías dicen en qué series aparece. Falta si el personaje no tiene página propia (entonces va `series`). */
    wiki: z.string().min(1).optional(),
    /** Series en que aparece, a mano, para quien no tiene página propia en la wiki. Sin `wiki`, es obligatorio. */
    series: z.array(seriesId).min(1).optional(),
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
    /** `true` si solo está en el anime o en sus películas, no en el manga: los modos lo dejan afuera con "Relleno" apagado. */
    filler: z.boolean().optional(),
    /** `true` si solo está en arcos del manga que todavía no se adaptaron al anime: afuera si se apagan los "Arcos del manga". */
    mangaOnly: z.boolean().optional(),
    verified: z.boolean(),
  })
  .strict()
  .refine((character) => character.wiki !== undefined || character.series !== undefined, {
    message: 'Hace falta `wiki` (página de la wiki) o `series` (a mano)',
  });

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
    addressee: z.string().min(1).optional(),
    adapted: z.boolean().optional(),
    literal: z.boolean(),
    famous: z.boolean(),
    verified: z.boolean(),
  })
  .strict();

export const quotesSrcSchema = z.array(quoteSrcSchema).superRefine((quotes, ctx) => {
  const ids = new Set<string>();
  quotes.forEach(({ id }, index) => {
    if (ids.has(id)) ctx.addIssue({ code: 'custom', path: [index, 'id'], message: `ID de frase repetido: ${id}` });
    ids.add(id);
  });
});

export const eventSrcSchema = z
  .object({
    id: kebab,
    text: z.string().min(1),
    series: seriesId,
    /** Posición dentro de su serie, desde 1, sin repetir. El orden entre series lo da `seriesOrder`. */
    order: z.number().int().positive(),
    /** `true` si es de relleno del anime (no está en el manga): la línea de tiempo puede dejarlo afuera. */
    filler: z.boolean().optional(),
    /** `true` si es de un arco del manga que todavía no se adaptó al anime: la línea de tiempo puede dejarlo afuera. */
    mangaOnly: z.boolean().optional(),
    verified: z.boolean(),
  })
  .strict();

/**
 * Un grupo del modo Conexiones: 4 de sus miembros salen en un tablero junto a los de otros 3 grupos de las demás
 * dificultades. `members` tiene que listar a TODOS los personajes del grupo, no solo a los que se muestran: de ahí
 * sale la solución única (un personaje no entra al tablero si pertenece a otro de los grupos elegidos).
 */
export const connectionGroupSrcSchema = z
  .object({
    id: kebab,
    /** Lo que se muestra al resolver el grupo. */
    name: z.string().min(1),
    /** Qué clase de grupo es (raza, organización, planeta…). Es una etiqueta; no la usa la lógica. */
    category: z.string().min(1),
    /** 1 (fácil) a 4 (difícil). Un tablero lleva un grupo de cada dificultad. */
    difficulty: z.number().int().min(1).max(4),
    /** La serie del grupo: es la que lo filtra (con esa serie apagada, el grupo no sale). */
    series: seriesId,
    members: z.array(kebab).min(4),
    verified: z.boolean(),
  })
  .strict();

/**
 * `quiz.json`: una pregunta del Quiz. La respuesta correcta y los distractores son ids de personajes (las opciones);
 * `excluded` lista a quienes podrían discutirse como correctos: no se usan como distractores y no se muestran.
 */
export const quizQuestionSrcSchema = z
  .object({
    id: z.string().regex(/^q-\d{3}$/),
    question: z.string().min(10),
    /** A qué parte de la historia se refiere ("Anime de Dragon Ball Z, saga de los Saiyajin"). */
    scope: z.string().min(1),
    series: seriesId,
    type: z.enum(['quien-mato', 'maestro-discipulo', 'primera-ultima-vez', 'intruso', 'muertes', 'fusiones', 'familia', 'lugares-organizaciones', 'tecnicas-transformaciones', 'curiosidad']),
    correct: kebab,
    /** Exactamente 11: con la dificultad más difícil (12 opciones) se usan todos. */
    distractors: z.array(kebab).length(11),
    excluded: z.array(kebab),
    explanation: z.string().min(10),
    source: z.string().url(),
    verified: z.boolean(),
  })
  .strict();

export type SagasFile = z.infer<typeof sagasFileSchema>;
export type CharacterSrc = z.infer<typeof characterSrcSchema>;
export type TechniqueSrc = z.infer<typeof techniqueSrcSchema>;
export type QuoteSrc = z.infer<typeof quoteSrcSchema>;
export type EventSrc = z.infer<typeof eventSrcSchema>;
export type ConnectionGroupSrc = z.infer<typeof connectionGroupSrcSchema>;
export type QuizQuestionSrc = z.infer<typeof quizQuestionSrcSchema>;

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
    payload: z
      .object({
        text: z.string().min(1),
        order: z.number().int().positive(),
        filler: z.literal(true).optional(),
        mangaOnly: z.literal(true).optional(),
      })
      .strict(),
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
