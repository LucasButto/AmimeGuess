/** Lo que tarda en bajar la página hasta un elemento (al terminar una partida o al empezar otra). */
export const SCROLL_MS = 1400;

/**
 * Lleva la página hasta `target` con una animación propia: el desplazamiento suave del navegador no deja elegir cuánto
 * dura. Si la persona toca la pantalla, mueve la rueda o aprieta una tecla, se detiene y no le pelea. Con
 * "reducir movimiento" va de golpe. Devuelve la función que la cancela.
 */
export function scrollToElement(target: HTMLElement): () => void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    target.scrollIntoView({ block: 'start' });
    return () => undefined;
  }
  const margin = parseFloat(getComputedStyle(target).scrollMarginBlockStart) || 0;
  const from = window.scrollY;
  const to = Math.min(from + target.getBoundingClientRect().top - margin, document.documentElement.scrollHeight - window.innerHeight);
  let frame = 0;
  const started = performance.now();
  const step = (now: number) => {
    const t = Math.min((now - started) / SCROLL_MS, 1);
    const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    window.scrollTo(0, from + (to - from) * eased);
    if (t < 1) frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);

  const cancel = () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('wheel', cancel);
    window.removeEventListener('touchstart', cancel);
    window.removeEventListener('keydown', cancel);
  };
  window.addEventListener('wheel', cancel, { passive: true });
  window.addEventListener('touchstart', cancel, { passive: true });
  window.addEventListener('keydown', cancel);
  return cancel;
}
