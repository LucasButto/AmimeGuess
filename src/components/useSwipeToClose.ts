import { useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';

/** Cuánto hay que arrastrar hacia abajo (en rem) para que suelte y cierre. */
const CLOSE_DISTANCE_REM = 6;

/**
 * Cerrar un diálogo del teléfono deslizando hacia abajo desde su encabezado (o el asa). Sin dependencias: sigue el dedo con
 * `transform` (solo eso se anima), cierra si se arrastró lo suficiente y, si no, vuelve a su lugar. Solo con el dedo o el
 * lápiz: con mouse el encabezado conserva lo que ya hacía (arrastrar el diálogo en escritorio).
 *
 * Cada función devuelve `true` si atendió el gesto, para que quien ya tenía sus propios manejadores sepa si seguir.
 */
export function useSwipeToClose(dialogRef: RefObject<HTMLElement | null>, onClose: () => void) {
  const swipe = useRef<{ pointerId: number; startY: number; distance: number } | null>(null);

  function start(event: ReactPointerEvent<HTMLElement>): boolean {
    const dialog = dialogRef.current;
    if (!dialog || event.pointerType === 'mouse') return false;
    // Los botones del encabezado (la ✕) siguen siendo botones.
    if (event.target instanceof Element && event.target.closest('button, a, input')) return false;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // El puntero ya no está activo: no hay nada que capturar.
    }
    dialog.style.transition = 'none';
    swipe.current = { pointerId: event.pointerId, startY: event.clientY, distance: 0 };
    return true;
  }

  function move(event: ReactPointerEvent<HTMLElement>): boolean {
    const current = swipe.current;
    const dialog = dialogRef.current;
    if (!current || !dialog || current.pointerId !== event.pointerId) return false;
    current.distance = Math.max(0, event.clientY - current.startY);
    dialog.style.transform = `translateY(${current.distance}px)`;
    return true;
  }

  function end(event: ReactPointerEvent<HTMLElement>): boolean {
    const current = swipe.current;
    const dialog = dialogRef.current;
    if (!current || !dialog || current.pointerId !== event.pointerId) return false;
    swipe.current = null;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    if (event.type === 'pointerup' && current.distance > CLOSE_DISTANCE_REM * rem) {
      onClose();
      return true;
    }
    // No llegó: vuelve a su lugar (sin movimiento si la persona pidió reducirlo).
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    dialog.style.transition = reduced ? 'none' : 'transform 0.18s ease-out';
    dialog.style.transform = '';
    return true;
  }

  return { start, move, end };
}
