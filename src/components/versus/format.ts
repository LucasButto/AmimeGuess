/** Milisegundos como reloj corto: `0:42`, `2:05`, `1:02:03`. Nunca negativo. */
export function formatClock(ms: number, round: 'up' | 'down' = 'down'): string {
  const totalSeconds = Math.max(0, round === 'up' ? Math.ceil(ms / 1000) : Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}
