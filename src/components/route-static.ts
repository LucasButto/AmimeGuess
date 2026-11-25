'use client';

// La estática del televisor entre el inicio y lo demás, como un cambio de canal. Una sola capa para todo el sitio (la dibuja
// `RouteStatic`, en el layout raíz, que no se desmonta al navegar): al ir al inicio desde cualquier página, o del televisor a una
// franquicia, la estática tapa la ventana en el acto, se navega por debajo y se disipa en la página nueva. Esa página no
// reproduce su animación de entrada (ver `EntranceGate`): se llegó cambiando de canal.

/** Lo que tarda la estática en tapar la ventana (la primera parte de `tv-full-in`); recién ahí se navega. */
export const STATIC_COVER_MS = 160;
/** Si la página nueva no llega en este tiempo, la estática se levanta igual (no se queda la ventana tapada). */
const STATIC_GIVE_UP_MS = 5000;

let covering = false;
let giveUp: ReturnType<typeof setTimeout> | undefined;
let shownPath: string | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeStatic(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Si la estática está tapando la ventana mientras se navega. */
export function isCovering(): boolean {
  return covering;
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Tapa la ventana con la estática y, ya tapada, navega a `href` con `push`. Con movimiento reducido navega enseguida, sin
 * estática. Si ya hay una en curso no hace nada (un segundo toque no navega dos veces).
 */
export function goThroughStatic(push: (href: string) => void, href: string): void {
  if (prefersReducedMotion()) {
    push(href);
    return;
  }
  if (covering) return;
  covering = true;
  notify();
  setTimeout(() => push(href), STATIC_COVER_MS);
  giveUp = setTimeout(endCover, STATIC_GIVE_UP_MS);
}

/** La página nueva ya está: la estática deja de tapar y se disipa (la parte de salida la dibuja `RouteStatic`). */
export function endCover(): void {
  if (giveUp !== undefined) clearTimeout(giveUp);
  giveUp = undefined;
  if (!covering) return;
  covering = false;
  notify();
}

/** La ruta que está en pantalla. `RouteStatic` la anota después de cada cambio; mientras se dibuja la página nueva, todavía
 * es la anterior (de dónde se vino). */
export function previousPath(): string | null {
  return shownPath;
}

export function settlePath(path: string): void {
  shownPath = path;
}
