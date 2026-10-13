// Tiempos de la revelación por columnas del Clásico (SPEC 9.2). Al enviar un intento, cada columna de
// atributos pasa de su dorso a su cara, de izquierda a derecha, con un desfase entre una y la siguiente.
// La revelación completa nunca pasa de 2,4 s: con muchas columnas el desfase se achica. Lógica pura.

/** Tope de la revelación completa, en milisegundos. */
export const MAX_REVEAL_MS = 2400;

/** Duración del fundido que reemplaza al giro con `prefers-reduced-motion`. */
export const REDUCED_REVEAL_MS = 150;

export interface RevealTiming {
  /** Cuándo empieza cada columna, en milisegundos desde el envío. Estrictamente crecientes. */
  readonly delays: readonly number[];
  /** Cuánto dura el giro de cada celda. */
  readonly duration: number;
  /** Cuándo termina la última celda: la revelación completa. */
  readonly total: number;
}

/**
 * Los tiempos de `columns` columnas con la duración y el desfase del tema (`--flip-duration`,
 * `--flip-stagger`). El desfase se reduce lo necesario para no pasar de `max`, sin dejar de crecer.
 */
export function revealTiming(columns: number, duration: number, stagger: number, max = MAX_REVEAL_MS): RevealTiming {
  const cellDuration = Math.max(0, Math.min(duration, max - Math.max(0, columns - 1)));
  if (columns <= 0) return { delays: [], duration: cellDuration, total: 0 };
  const room = columns > 1 ? (max - cellDuration) / (columns - 1) : 0;
  // Al menos 1 ms entre columnas, para que el orden siempre se note y los retrasos crezcan.
  const step = columns > 1 ? Math.max(1, Math.min(stagger, room)) : 0;
  const delays = Array.from({ length: columns }, (_, index) => Math.floor(index * step));
  return { delays, duration: cellDuration, total: delays[columns - 1] + cellDuration };
}

/** Con movimiento reducido: sin desfase largo, todas las celdas aparecen juntas con un fundido corto. */
export function reducedRevealTiming(columns: number): RevealTiming {
  return { delays: Array.from({ length: Math.max(0, columns) }, () => 0), duration: REDUCED_REVEAL_MS, total: columns > 0 ? REDUCED_REVEAL_MS : 0 };
}

/** Un tiempo de CSS (`450ms`, `0.45s`) en milisegundos, o `fallback` si no se entiende. */
export function parseCssTime(value: string, fallback: number): number {
  const match = /^\s*(-?\d*\.?\d+)\s*(ms|s)\s*$/i.exec(value);
  if (!match) return fallback;
  const amount = Number.parseFloat(match[1]);
  const ms = match[2].toLowerCase() === 's' ? amount * 1000 : amount;
  return Number.isFinite(ms) && ms >= 0 ? ms : fallback;
}
