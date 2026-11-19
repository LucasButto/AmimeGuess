import {
  DEFAULT_OPTIONS,
  LIMITS,
  defaultTimeLimit,
  expandRepeat,
  parseConfig,
  type Modality,
  type ParseResult,
  type Partida,
  type VersusEngine,
  type VersusOptions,
} from '@/versus/config';

// El borrador de una sala en la pantalla "Crear sala" (docs/versus/05-fase-3-interfaz.md, paso 3.2): lógica pura, sin React.
// Una sala se arma con bloques ("Pokémon Clásico ×3"); al crearla se expanden las repeticiones y se valida con `parseConfig`.

/** Un bloque de la lista: una partida y cuántas veces seguidas se juega. */
export interface Block {
  readonly id: string;
  /** Con `timeLimitMs` siempre (el sugerido o el editado): solo se usa en Contrarreloj, pero se conserva por si se vuelve a ella. */
  readonly partida: Partida & { readonly timeLimitMs: number; readonly defaultTimeLimitMs: number };
  readonly count: number;
  /** Cuántos segundos del tiempo sugerido vienen del extra por series (para la nota "+40 s por 9 generaciones"). */
  readonly extraSeconds: number;
}

export interface Draft {
  readonly modality: Modality;
  readonly blocks: readonly Block[];
  readonly options: VersusOptions;
  readonly name: string;
}

export const EMPTY_DRAFT: Draft = { modality: 'timeAttack', blocks: [], options: { ...DEFAULT_OPTIONS }, name: '' };

export interface NewBlockInput {
  readonly id: string;
  readonly franchise: string;
  readonly mode: string;
  readonly engine: VersusEngine;
  readonly variant?: string;
  readonly series: readonly string[];
  readonly toggles?: Readonly<Record<string, boolean>>;
  /** `versusSecondsPerExtraSeries` de la franquicia. */
  readonly secondsPerExtraSeries: number;
  readonly count: number;
}

/** Un bloque nuevo, con el tiempo sugerido de su motor más el extra por series. */
export function newBlock(input: NewBlockInput): Block {
  const defaultMs = defaultTimeLimit(input.engine, input.series.length, input.secondsPerExtraSeries);
  const withoutExtra = defaultTimeLimit(input.engine, 1, input.secondsPerExtraSeries);
  return {
    id: input.id,
    count: input.count,
    extraSeconds: Math.round((defaultMs - withoutExtra) / 1000),
    partida: {
      franchise: input.franchise,
      mode: input.mode,
      engine: input.engine,
      ...(input.variant === undefined ? {} : { variant: input.variant }),
      series: [...input.series],
      ...(input.toggles && Object.keys(input.toggles).length > 0 ? { toggles: { ...input.toggles } } : {}),
      timeLimitMs: defaultMs,
      defaultTimeLimitMs: defaultMs,
    },
  };
}

// --- Cantidades ------------------------------------------------------------------------------------------------------

export const totalPartidas = (blocks: readonly Block[]): number => blocks.reduce((sum, block) => sum + block.count, 0);

/** Cuántas partidas más entran (de las 10). */
export const remainingPartidas = (blocks: readonly Block[]): number => Math.max(0, LIMITS.partidas.max - totalPartidas(blocks));

/** El tiempo máximo de la sala en Contrarreloj: la suma de los tiempos límite de todas las partidas. */
export const maxTimeMs = (blocks: readonly Block[]): number => blocks.reduce((sum, block) => sum + block.partida.timeLimitMs * block.count, 0);

/** Agrega el bloque al final; sin pasar de 10 partidas en total (si no entra entero, se recorta el ×N). */
export function addBlock(blocks: readonly Block[], block: Block): Block[] {
  const room = remainingPartidas(blocks);
  if (room <= 0) return [...blocks];
  return [...blocks, { ...block, count: Math.max(1, Math.min(block.count, room)) }];
}

export function removeBlock(blocks: readonly Block[], id: string): Block[] {
  return blocks.filter((block) => block.id !== id);
}

/** Cambia el ×N de un bloque: al menos 1 y sin pasar de 10 partidas en total. */
export function setBlockCount(blocks: readonly Block[], id: string, count: number): Block[] {
  return blocks.map((block) => {
    if (block.id !== id) return block;
    const others = totalPartidas(blocks) - block.count;
    return { ...block, count: Math.max(1, Math.min(Math.floor(count), LIMITS.partidas.max - others)) };
  });
}

/** Sube (`-1`) o baja (`1`) un bloque en la lista. */
export function moveBlock(blocks: readonly Block[], id: string, direction: -1 | 1): Block[] {
  const index = blocks.findIndex((block) => block.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= blocks.length) return [...blocks];
  const next = [...blocks];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

// --- Tiempo límite ---------------------------------------------------------------------------------------------------

/** El tiempo dentro de los límites (10 s a 30 min) y en pasos de 5 s. */
export function clampTime(ms: number): number {
  const { min, max, step } = LIMITS.timeLimitMs;
  return Math.min(max, Math.max(min, Math.round(ms / step) * step));
}

/** Cambia el tiempo límite de un bloque a mano. */
export function setBlockTime(blocks: readonly Block[], id: string, ms: number): Block[] {
  return blocks.map((block) => (block.id === id ? { ...block, partida: { ...block.partida, timeLimitMs: clampTime(ms), timeEdited: true } } : block));
}

/** Suma o resta un paso (5 s) al tiempo de un bloque. */
export function stepBlockTime(blocks: readonly Block[], id: string, direction: -1 | 1): Block[] {
  const block = blocks.find((candidate) => candidate.id === id);
  return block ? setBlockTime(blocks, id, block.partida.timeLimitMs + direction * LIMITS.timeLimitMs.step) : [...blocks];
}

/** "Volver al tiempo sugerido". */
export function resetBlockTime(blocks: readonly Block[], id: string): Block[] {
  return blocks.map((block) => {
    if (block.id !== id) return block;
    const partida: Block['partida'] & { timeEdited?: boolean } = { ...block.partida, timeLimitMs: block.partida.defaultTimeLimitMs };
    delete partida.timeEdited;
    return { ...block, partida };
  });
}

/** Lo que escribe la persona como tiempo: `1:30`, `90`, `0:45`. `null` si no se entiende. */
export function parseClock(text: string): number | null {
  const match = /^\s*(?:(\d{1,2}):)?(\d{1,4})\s*$/.exec(text);
  if (!match) return null;
  const [, minutes, seconds] = match;
  if (minutes !== undefined) return Number(seconds) >= 60 ? null : (Number(minutes) * 60 + Number(seconds)) * 1000;
  return Number(seconds) * 1000;
}

// --- Opciones ----------------------------------------------------------------------------------------------------------

export interface VisibleOptions {
  readonly higherLowerTarget: boolean;
  readonly higherLowerForgiven: boolean;
  readonly statsTarget: boolean;
  readonly statsAggregation: boolean;
}

/** Qué opciones corresponden a las partidas y a la modalidad (tabla de `01-reglas.md`, sección 1). */
export function visibleOptions(modality: Modality, blocks: readonly Block[]): VisibleOptions {
  return visibleOptionsFor(modality, blocks.map((block) => block.partida.engine));
}

/** Lo mismo, a partir de los motores de las partidas (sirve también para una sala ya creada). */
export function visibleOptionsFor(modality: Modality, engines: readonly VersusEngine[]): VisibleOptions {
  const has = (engine: VersusEngine) => engines.includes(engine);
  const fewest = modality === 'fewestAttempts';
  return {
    higherLowerTarget: has('higher-lower') && !fewest,
    higherLowerForgiven: has('higher-lower') && fewest,
    statsTarget: has('stat-builder') && !fewest,
    statsAggregation: has('stat-builder') && fewest,
  };
}

/** Un número dentro de [min, max], de a `step`. */
export function clampNumber(value: number, min: number, max: number, step = 1): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value / step) * step));
}

// --- Armar la sala -----------------------------------------------------------------------------------------------------

/** La configuración para el servidor: repeticiones expandidas y, fuera de Contrarreloj, sin tiempos límite. */
export function buildConfig(draft: Draft): ParseResult {
  const timed = draft.modality === 'timeAttack';
  const partidas = draft.blocks.flatMap((block) => {
    const { timeLimitMs, timeEdited, ...rest } = block.partida;
    return expandRepeat(timed ? { ...rest, timeLimitMs, ...(timeEdited ? { timeEdited } : {}) } : rest, block.count);
  });
  // Solo viajan las opciones que valen para esta sala; el resto queda en sus valores por defecto.
  const shown = visibleOptions(draft.modality, draft.blocks);
  const options = {
    higherLowerTarget: shown.higherLowerTarget ? draft.options.higherLowerTarget : DEFAULT_OPTIONS.higherLowerTarget,
    higherLowerForgiven: shown.higherLowerForgiven ? draft.options.higherLowerForgiven : DEFAULT_OPTIONS.higherLowerForgiven,
    statsTarget: shown.statsTarget ? draft.options.statsTarget : DEFAULT_OPTIONS.statsTarget,
    statsAggregation: shown.statsAggregation ? draft.options.statsAggregation : DEFAULT_OPTIONS.statsAggregation,
  };
  return parseConfig({ modality: draft.modality, partidas, options });
}

/** Si el borrador se puede crear: al menos una partida y un apodo válido. */
export function canCreate(draft: Draft, nameValid: boolean): boolean {
  return draft.blocks.length > 0 && nameValid;
}
