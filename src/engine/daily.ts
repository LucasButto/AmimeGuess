import { fmix32, fnv1a32 } from './hash';

// Reto diario global por combinación de filtros (SPEC sección 5). Todo se
// calcula a partir de (franchise, mode, filterKey, day) y del pool: nada de
// azar ni de reloj, así dos personas con los mismos filtros ven el mismo reto.

export interface DailyContext {
  readonly franchise: string;
  readonly mode: string;
  /** Clave de filtro canónica (`all`, `g1.g2`…). */
  readonly filterKey: string;
  /** Número de día, ver `getDay`. */
  readonly day: number;
}

/** Tope de días anteriores cuyos ganadores se excluyen. */
export const MAX_EXCLUSION_DAYS = 14;

/** K = min(14, floor(n / 3)): cuántos días previos se excluyen para un pool de n elementos. */
export function exclusionWindow(poolSize: number): number {
  return Math.min(MAX_EXCLUSION_DAYS, Math.floor(poolSize / 3));
}

/** Semilla para los modos de secuencia (higher-lower, timeline, connections). */
export function seedFor(ctx: DailyContext): number {
  return fnv1a32(`${ctx.franchise}|${ctx.mode}|${ctx.filterKey}|${ctx.day}`);
}

// El score es fnv1a32 de la clave, mezclado con fmix32. FNV-1a solo mezcla poco
// los últimos bytes: con ids del mismo largo que difieren al final (`item-001`,
// `item-002`…) un elemento llegaba a ganar el 14 % de los días y dos filtros
// distintos repetían ganador el 29 % de las veces. El mezclador final lo
// corrige sin cambiar el método (rendezvous) ni el desempate. Cambiar el score
// cambia el reto de todos: los vectores de daily.test.ts lo protegen.
function scoreOf(ctx: DailyContext, id: string): number {
  return fmix32(fnv1a32(`${ctx.franchise}|${ctx.mode}|${ctx.filterKey}|${ctx.day}|${id}`));
}

// Comparación por unidades de código, no por idioma: el desempate no puede
// depender de la configuración regional de cada dispositivo.
function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Ganador "crudo" del día: el elemento de menor score, con desempate por id.
 * No excluye nada. Los `ids` de `excluded` se saltean. Devuelve `undefined`
 * solo si el pool queda vacío.
 */
function lowestScore<T extends { id: string }>(
  pool: readonly T[],
  ctx: DailyContext,
  excluded?: ReadonlySet<string>,
): T | undefined {
  let best: T | undefined;
  let bestScore = 0;
  for (const item of pool) {
    if (excluded?.has(item.id)) continue;
    const score = scoreOf(ctx, item.id);
    if (
      best === undefined ||
      score < bestScore ||
      (score === bestScore && compareIds(item.id, best.id) < 0)
    ) {
      best = item;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Hash de rendezvous: el ganador crudo de un día, sin exclusiones. Es la base
 * de `pickDaily`; se expone para poder verificar la ventana de exclusión.
 */
export function pickRaw<T extends { id: string }>(pool: readonly T[], ctx: DailyContext): T {
  const winner = lowestScore(pool, ctx);
  if (winner === undefined) throw new RangeError('El pool está vacío');
  return winner;
}

/**
 * Respuesta del día: el elemento de menor score que no sea el ganador crudo de
 * ninguno de los K días anteriores. Los ids del pool deben ser únicos; el
 * orden del pool no influye.
 */
export function pickDaily<T extends { id: string }>(pool: readonly T[], ctx: DailyContext): T {
  const excluded = new Set<string>();
  const window = exclusionWindow(pool.length);
  for (let back = 1; back <= window; back++) {
    excluded.add(pickRaw(pool, { ...ctx, day: ctx.day - back }).id);
  }
  const winner = lowestScore(pool, ctx, excluded);
  if (winner === undefined) throw new RangeError('El pool está vacío');
  return winner;
}

/** La respuesta de ayer para la misma combinación de filtros ("Ayer fue…"). */
export function yesterday<T extends { id: string }>(pool: readonly T[], ctx: DailyContext): T {
  return pickDaily(pool, { ...ctx, day: ctx.day - 1 });
}
