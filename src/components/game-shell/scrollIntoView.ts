/**
 * Deja `target` entero en pantalla moviendo la página lo justo (nunca de vuelta arriba). El hueco que dejan la barra
 * superior y la barra inferior sale de su `scroll-margin`. Con "reducir movimiento" va de golpe.
 */
export function scrollIntoViewNearest(target: Element | null | undefined): void {
  if (!target) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
}

/** Cuánto espera el marco, tras el último cambio del juego, antes de bajar solo hasta el resultado (diseño de app). */
export const RESULT_SETTLE_MS = 600;
