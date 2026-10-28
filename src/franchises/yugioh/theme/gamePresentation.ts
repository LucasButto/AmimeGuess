/** Presentación únicamente: nunca se usan estos valores para resolver una partida. */
export const START_LP = 8000;
export const MIN_UNLIMITED_LP = 800;

export function lifePoints(failed: number, total?: number): number {
  const misses = Math.max(0, Math.floor(failed));
  if (total !== undefined && total > 0) return Math.max(0, Math.round(START_LP * (1 - Math.min(misses, total) / total)));
  return Math.max(MIN_UNLIMITED_LP, START_LP - misses * 800);
}

export function classFrame(value: string): string {
  const name = value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  if (name.includes('pendulo')) return 'pendulum';
  if (name.includes('fusion')) return 'fusion';
  if (name.includes('ritual')) return 'ritual';
  if (name.includes('sincro')) return 'synchro';
  if (name.includes('xyz')) return 'xyz';
  if (name.includes('enlace') || name.includes('link')) return 'link';
  if (name.includes('mag')) return 'spell';
  if (name.includes('trampa')) return 'trap';
  if (name.includes('efecto')) return 'effect';
  return 'normal';
}
