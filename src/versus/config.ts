import { z } from 'zod';

// Configuración de una sala de versus (docs/versus/01-reglas.md, sección 1). Lógica pura compartida por el sitio y el
// servidor de salas: solo imports relativos, nada de React ni Next, y ninguna franquicia por nombre. El servidor valida
// con esto la forma y los límites; el sitio valida además que franquicia, modo y filtros existan (`isValidForSite`, en
// src/components/versus/).

/** Las modalidades: Contrarreloj, Carrera y Menos intentos. */
export const MODALITIES = ['timeAttack', 'race', 'fewestAttempts'] as const;
export type Modality = (typeof MODALITIES)[number];

/**
 * Los motores de juego, con los mismos ids que `EngineId` (src/franchises/types.ts; un test lo comprueba). Cada partida
 * guarda el suyo para que el servidor aplique las reglas sin conocer las franquicias.
 */
export const VERSUS_ENGINES = [
  'classic',
  'image-reveal',
  'text-clue',
  'reveal-list',
  'higher-lower',
  'timeline',
  'connections',
  'stat-builder',
  'category-board',
] as const;
export type VersusEngine = (typeof VERSUS_ENGINES)[number];

/** Cómo cuentan las 3 combinaciones de Estadísticas en Menos intentos. */
export const STATS_AGGREGATIONS = ['best', 'sum', 'average'] as const;
export type StatsAggregation = (typeof STATS_AGGREGATIONS)[number];

export const LIMITS = {
  partidas: { min: 1, max: 10 },
  players: { min: 2, max: 10 },
  name: { min: 1, max: 16 },
  /** Tiempo límite de una partida en Contrarreloj: de 10 s a 30 min, de a 5 s. */
  timeLimitMs: { min: 10_000, max: 1_800_000, step: 5_000 },
  higherLowerTarget: { min: 1, max: 100 },
  higherLowerForgiven: { min: 0, max: 5 },
  statsTarget: { min: 100, max: 1_500, step: 10 },
} as const;

export const DEFAULT_OPTIONS: {
  readonly higherLowerTarget: number;
  readonly higherLowerForgiven: number;
  readonly statsTarget: number;
  readonly statsAggregation: StatsAggregation;
} = {
  higherLowerTarget: 10,
  higherLowerForgiven: 3,
  statsTarget: 500,
  statsAggregation: 'best',
};

/** Un slug o id de los datos: minúsculas, dígitos y guiones. */
const slug = z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/);
/** La variante de un modo como la arma su motor (`m-<medida>` en Mayor o Menor, `d2` en Línea de tiempo). */
const variantId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9-]{0,39}$/);

const partidaSchema = z.strictObject({
  franchise: slug,
  mode: slug,
  engine: z.enum(VERSUS_ENGINES),
  /** Variante del modo, si tiene (medida de Mayor o Menor, dificultad de Línea de tiempo). */
  variant: variantId.optional(),
  /** Series activas: los mismos ids de la configuración de la franquicia. */
  series: z
    .array(slug)
    .min(1)
    .max(20)
    .refine((ids) => new Set(ids).size === ids.length, 'series repetidas'),
  /** Interruptores de la partida (relleno, arcos del manga): no cuentan como series. Los que faltan, prendidos. */
  toggles: z.record(slug, z.boolean()).optional(),
  /** Solo Contrarreloj: el tiempo límite de esta partida. */
  timeLimitMs: z
    .number()
    .int()
    .min(LIMITS.timeLimitMs.min)
    .max(LIMITS.timeLimitMs.max)
    .multipleOf(LIMITS.timeLimitMs.step)
    .optional(),
  /** Si el creador cambió el tiempo a mano: entonces cambiar los filtros ya no lo recalcula. */
  timeEdited: z.boolean().optional(),
});

const optionsSchema = z.strictObject({
  higherLowerTarget: z.number().int().min(LIMITS.higherLowerTarget.min).max(LIMITS.higherLowerTarget.max).default(DEFAULT_OPTIONS.higherLowerTarget),
  higherLowerForgiven: z.number().int().min(LIMITS.higherLowerForgiven.min).max(LIMITS.higherLowerForgiven.max).default(DEFAULT_OPTIONS.higherLowerForgiven),
  statsTarget: z
    .number()
    .int()
    .min(LIMITS.statsTarget.min)
    .max(LIMITS.statsTarget.max)
    .multipleOf(LIMITS.statsTarget.step)
    .default(DEFAULT_OPTIONS.statsTarget),
  statsAggregation: z.enum(STATS_AGGREGATIONS).default(DEFAULT_OPTIONS.statsAggregation),
});

export const versusConfigSchema = z
  .strictObject({
    modality: z.enum(MODALITIES),
    /** Las partidas en orden, con las repeticiones (×N) expandidas. */
    partidas: z.array(partidaSchema).min(LIMITS.partidas.min).max(LIMITS.partidas.max),
    options: optionsSchema.prefault({}),
  })
  .superRefine((config, ctx) => {
    config.partidas.forEach((partida, index) => {
      const timed = partida.timeLimitMs !== undefined;
      if (config.modality === 'timeAttack' && !timed) {
        ctx.addIssue({ code: 'custom', path: ['partidas', index, 'timeLimitMs'], message: 'Contrarreloj necesita un tiempo límite por partida' });
      }
      if (config.modality !== 'timeAttack' && timed) {
        ctx.addIssue({ code: 'custom', path: ['partidas', index, 'timeLimitMs'], message: 'solo Contrarreloj tiene tiempo límite' });
      }
    });
  });

export type Partida = z.infer<typeof partidaSchema>;
export type VersusOptions = z.infer<typeof optionsSchema>;
export type VersusConfig = z.infer<typeof versusConfigSchema>;
/** Lo que se le pasa a `parseConfig`: las opciones pueden faltar y toman los valores por defecto. */
export type VersusConfigInput = z.input<typeof versusConfigSchema>;

export type ParseResult = { readonly ok: true; readonly config: VersusConfig } | { readonly ok: false; readonly errors: readonly string[] };

/** La configuración validada, o la lista de errores ("partidas.0.timeLimitMs: …"). */
export function parseConfig(raw: unknown): ParseResult {
  const result = versusConfigSchema.safeParse(raw);
  if (result.success) return { ok: true, config: result.data };
  return { ok: false, errors: result.error.issues.map((issue) => `${issue.path.join('.') || '(raíz)'}: ${issue.message}`) };
}

/** Si un apodo vale: de 1 a 16 caracteres, sin saltos de línea ni caracteres de control. */
export function isValidName(name: string): boolean {
  const chars = [...name];
  const control = chars.some((char) => {
    const code = char.codePointAt(0) ?? 0;
    return code < 0x20 || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029;
  });
  return chars.length >= LIMITS.name.min && chars.length <= LIMITS.name.max && name.trim().length > 0 && !control;
}

// --- Tiempo por defecto (Contrarreloj) --------------------------------------------------------------------------------

/**
 * Tiempo por defecto de cada motor (01-reglas.md, sección 1). Se decide por motor, nunca por franquicia: el Clásico es
 * `classic` en todas. Casillas (`category-board`) es posterior a la tabla de reglas: queda con 3:00 hasta que se decida.
 */
const BASE_SECONDS: Readonly<Record<VersusEngine, number>> = {
  'image-reveal': 60,
  'text-clue': 60,
  'reveal-list': 60,
  classic: 90,
  timeline: 120,
  'higher-lower': 120,
  connections: 180,
  'stat-builder': 180,
  'category-board': 180,
};

/**
 * Tiempo por defecto de una partida de Contrarreloj, en ms: el de su motor más `secondsPerExtraSeries` por cada serie
 * activa a partir de la segunda (sale de la configuración de la franquicia). Queda dentro de los límites y en pasos de 5 s.
 */
export function defaultTimeLimit(engine: VersusEngine, activeSeries: number, secondsPerExtraSeries: number): number {
  const extra = Math.max(0, activeSeries - 1) * Math.max(0, secondsPerExtraSeries);
  const ms = (BASE_SECONDS[engine] + extra) * 1000;
  const { min, max, step } = LIMITS.timeLimitMs;
  return Math.min(max, Math.max(min, Math.round(ms / step) * step));
}

/**
 * El tiempo de una partida después de cambiarle los filtros: si el creador lo editó a mano se conserva; si no, se
 * recalcula con las series nuevas.
 */
export function retimePartida(partida: Partida, secondsPerExtraSeries: number): Partida {
  if (partida.timeLimitMs === undefined || partida.timeEdited) return partida;
  return { ...partida, timeLimitMs: defaultTimeLimit(partida.engine, partida.series.length, secondsPerExtraSeries) };
}

// --- Repeticiones -----------------------------------------------------------------------------------------------------

/** Un bloque de la lista para mostrar: una partida y cuántas veces seguidas se juega ("Pokémon Clásico ×3"). */
export interface RepeatGroup {
  readonly partida: Partida;
  readonly count: number;
  /** Posición (desde 0) de la primera partida del bloque en la lista expandida. */
  readonly start: number;
}

/** `n` copias de la misma partida: se juegan seguidas y cada una tiene su propio reto (su índice es otro). */
export function expandRepeat(partida: Partida, n: number): Partida[] {
  return Array.from({ length: Math.max(0, Math.floor(n)) }, () => ({ ...partida, series: [...partida.series], ...(partida.toggles ? { toggles: { ...partida.toggles } } : {}) }));
}

/** Agrupa las partidas iguales y seguidas en bloques ×N. */
export function groupRepeats(partidas: readonly Partida[]): RepeatGroup[] {
  const groups: RepeatGroup[] = [];
  partidas.forEach((partida, index) => {
    const last = groups[groups.length - 1];
    if (last && samePartida(last.partida, partida)) {
      groups[groups.length - 1] = { ...last, count: last.count + 1 };
    } else {
      groups.push({ partida, count: 1, start: index });
    }
  });
  return groups;
}

/** Si dos partidas son la misma configuración (mismo modo, variante, filtros, interruptores y tiempo). */
export function samePartida(a: Partida, b: Partida): boolean {
  return (
    a.franchise === b.franchise &&
    a.mode === b.mode &&
    a.engine === b.engine &&
    a.variant === b.variant &&
    a.timeLimitMs === b.timeLimitMs &&
    Boolean(a.timeEdited) === Boolean(b.timeEdited) &&
    sameList(a.series, b.series) &&
    sameToggles(a.toggles, b.toggles)
  );
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function sameToggles(a: Readonly<Record<string, boolean>> | undefined, b: Readonly<Record<string, boolean>> | undefined): boolean {
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  // Un interruptor que no está queda prendido, como en el juego de siempre.
  return [...keys].every((key) => (a?.[key] ?? true) === (b?.[key] ?? true));
}
