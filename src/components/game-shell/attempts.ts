import type { GameState } from '@/engine/storage';

/** `try` es el máximo con todo el catálogo; cada reducción a la mitad resta un intento. */
export function attemptLimit(base: number, remaining: number, fullPool: number, adaptive: boolean): number {
  if (!adaptive) return base;
  const reduction = Math.floor(Math.log2(Math.max(1, fullPool) / Math.max(1, remaining)));
  return Math.min(base, Math.max(3, base - Math.max(0, reduction)));
}

/** Las ayudas llegan antes del último intento, conservando su orden relativo. */
export function fitHints<T extends { readonly after: number }>(hints: readonly T[], limit: number): T[] {
  const last = Math.max(0, ...hints.map((hint) => hint.after));
  const scale = last >= limit ? Math.max(0, limit - 1) / last : 1;
  return hints.map((hint) => ({ ...hint, after: hint.after === 0 ? 0 : Math.min(limit - 1, Math.max(1, Math.round(hint.after * scale))) }));
}

/** No invalida victorias anteriores al cambio de límite. Las partidas abiertas sí respetan el nuevo máximo. */
export function restoreLimited(ids: string[], state: GameState | null, limit: number): string[] {
  return state?.result === 'won' ? ids : ids.slice(0, limit);
}
