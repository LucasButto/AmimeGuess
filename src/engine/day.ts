/** Inicio del día 0: medianoche de Argentina (UTC-3), 2026-01-01T03:00:00Z. */
export const EPOCH_MS = Date.UTC(2026, 0, 1, 3, 0, 0);

export const DAY_MS = 86_400_000;

/**
 * Número de día del reto: el mismo en todo el mundo, sin importar la zona
 * horaria del navegador. Recibe `now` en vez de leer el reloj para que sea
 * determinista y se pueda probar.
 */
export function getDay(now: Date): number {
  return Math.floor((now.getTime() - EPOCH_MS) / DAY_MS);
}

/** Milisegundos que faltan para el próximo reinicio del reto, entre 1 y 86.400.000. */
export function msUntilNextDay(now: Date): number {
  const nextDayStart = EPOCH_MS + (getDay(now) + 1) * DAY_MS;
  return nextDayStart - now.getTime();
}
