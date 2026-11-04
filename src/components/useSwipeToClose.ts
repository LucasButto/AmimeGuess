import { useEffect, useRef, type RefObject } from 'react';

/** Cuánto tiene que bajar el dedo (px) antes de que el gesto se tome como arrastre y no como un toque o un desplazamiento. */
const START_PX = 8;
/** Suelta y cierra si se bajó más de esta fracción de su alto (o de `CLOSE_MAX_PX`, lo que sea menor)… */
const CLOSE_RATIO = 0.22;
const CLOSE_MAX_PX = 150;
/** …o si al soltar el dedo iba hacia abajo más rápido que esto (px/ms), aunque se haya movido poco. */
const FLICK_SPEED = 0.55;
/** Si al soltar el dedo iba hacia arriba (px/ms), vuelve a su lugar aunque haya bajado mucho. */
const BACK_SPEED = -0.1;
/** La salida sigue la velocidad del dedo, con un mínimo, y dura entre estos dos valores (ms). */
const MIN_EXIT_SPEED = 0.9;
const EXIT_MIN_MS = 140;
const EXIT_MAX_MS = 300;
/** La velocidad se mide con los puntos de los últimos ms. */
const SAMPLE_MS = 100;
const SETTLE_MS = 320;
const SETTLE = `transform ${SETTLE_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`;

interface SwipeOptions {
  /** Si el gesto vale ahora (por ejemplo, solo con el diseño de app). Además, lo que se mueve tiene que ocupar todo el ancho. */
  enabled?: () => boolean;
  /**
   * Lo que se mueve con el dedo, si no es el diálogo mismo (por ejemplo, el panel de adentro: un `transform` en el `<dialog>`
   * lo volvería el contenedor de lo que tiene `position: fixed` adentro, como las ayudas ⓘ).
   */
  moveRef?: RefObject<HTMLElement | null>;
  /** `true` si quien lo usa se desmonta apenas se llama `onClose`: entonces se llama recién cuando terminó de salir. */
  waitExit?: boolean;
}

/** Si entre el punto tocado y el diálogo hay algo con desplazamiento vertical que no está arriba de todo. */
function scrolledAbove(target: EventTarget | null, root: HTMLElement): boolean {
  for (let node = target instanceof Element ? target : null; node && node !== root; node = node.parentElement) {
    if (node.scrollTop > 0 && /(auto|scroll)/.test(getComputedStyle(node).overflowY)) return true;
  }
  return false;
}

/**
 * Cerrar un diálogo del teléfono arrastrándolo hacia abajo con el dedo, desde cualquier parte: el encabezado, el asa o el
 * contenido cuando ya está arriba de todo (si no, el dedo desplaza el contenido). Mientras el dedo no se suelta, el diálogo
 * lo sigue (solo `transform`) y el fondo se aclara. Al soltar decide con la distancia y la velocidad: si iba hacia abajo
 * rápido o bajó bastante, sale siguiendo esa velocidad y llama a `onClose`; si iba hacia arriba o bajó poco, vuelve a su
 * lugar. Solo con el dedo (eventos táctiles): con mouse, el diálogo conserva lo que ya hacía.
 *
 * Mientras arrastra, el diálogo lleva `data-dragging` y la variable `--swipe-progress` (0 arriba, 1 afuera) para el fondo.
 */
export function useSwipeToClose(dialogRef: RefObject<HTMLElement | null>, onClose: () => void, { enabled, moveRef, waitExit = false }: SwipeOptions = {}) {
  const onCloseRef = useRef(onClose);
  const enabledRef = useRef(enabled);
  useEffect(() => {
    onCloseRef.current = onClose;
    enabledRef.current = enabled;
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    const mover = moveRef?.current ?? dialog;
    if (!dialog || !mover) return;
    let startX = 0;
    let startY = Number.NaN;
    let dragging = false;
    let samples: Array<[number, number]> = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function reset() {
      dragging = false;
      startY = Number.NaN;
      samples = [];
      dialog?.removeAttribute('data-dragging');
    }

    function onStart(event: TouchEvent) {
      const fullWidth = mover!.getBoundingClientRect().width >= window.innerWidth - 1;
      if (event.touches.length !== 1 || !fullWidth || (enabledRef.current && !enabledRef.current())) {
        startY = Number.NaN;
        return;
      }
      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      dragging = false;
      samples = [[performance.now(), touch.clientY]];
    }

    function onMove(event: TouchEvent) {
      if (Number.isNaN(startY)) return;
      const touch = event.touches[0];
      if (!touch) return;
      if (!dragging) {
        // Con contenido desplazado, el dedo lo desplaza; cuando llega arriba de todo, el mismo gesto empieza a bajar el diálogo.
        if (scrolledAbove(event.target, dialog!)) {
          startX = touch.clientX;
          startY = touch.clientY;
          return;
        }
        const dy = touch.clientY - startY;
        if (dy < START_PX || dy < Math.abs(touch.clientX - startX)) return;
        dragging = true;
        // Arranca desde cero en el umbral: sin salto.
        startY = touch.clientY;
        mover!.style.transition = 'none';
        dialog!.setAttribute('data-dragging', '');
      }
      if (event.cancelable) event.preventDefault();
      const offset = Math.max(0, touch.clientY - startY);
      mover!.style.transform = `translateY(${offset}px)`;
      dialog!.style.setProperty('--swipe-progress', String(Math.min(1, offset / Math.max(1, mover!.offsetHeight))));
      const now = performance.now();
      samples.push([now, touch.clientY]);
      samples = samples.filter(([time]) => now - time < SAMPLE_MS);
    }

    function onEnd(event: TouchEvent) {
      if (!dragging) {
        reset();
        return;
      }
      const first = samples[0];
      const last = samples[samples.length - 1];
      const speed = first && last && last[0] > first[0] ? (last[1] - first[1]) / (last[0] - first[0]) : 0;
      reset();
      const offset = new DOMMatrix(getComputedStyle(mover!).transform).m42;
      const far = offset > Math.min(CLOSE_MAX_PX, mover!.offsetHeight * CLOSE_RATIO);
      const close = event.type === 'touchend' && speed > BACK_SPEED && (far || speed > FLICK_SPEED);

      if (!close) {
        // Vuelve a su lugar con la curva de las hojas.
        mover!.style.transition = reduced() ? 'none' : SETTLE;
        mover!.style.transform = '';
        dialog!.style.removeProperty('--swipe-progress');
        clearTimeout(timer);
        timer = setTimeout(() => {
          if (mover) mover.style.transition = '';
        }, SETTLE_MS + 20);
        return;
      }

      // Sale siguiendo la velocidad del dedo (lineal, para no frenar ni arrancar de nuevo), hasta quedar fuera de la pantalla.
      const remaining = Math.max(0, window.innerHeight - mover!.getBoundingClientRect().top);
      const ms = reduced() ? 0 : Math.min(EXIT_MAX_MS, Math.max(EXIT_MIN_MS, remaining / Math.max(speed, MIN_EXIT_SPEED)));
      if (ms > 0) {
        mover!.style.transition = `transform ${Math.round(ms)}ms linear`;
        mover!.style.transform = `translateY(${Math.round(offset + remaining + 24)}px)`;
      }
      if (waitExit && ms > 0) {
        clearTimeout(timer);
        timer = setTimeout(() => onCloseRef.current(), ms);
      } else {
        onCloseRef.current();
      }
    }

    dialog.addEventListener('touchstart', onStart, { passive: true });
    dialog.addEventListener('touchmove', onMove, { passive: false });
    dialog.addEventListener('touchend', onEnd, { passive: true });
    dialog.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      clearTimeout(timer);
      dialog.removeEventListener('touchstart', onStart);
      dialog.removeEventListener('touchmove', onMove);
      dialog.removeEventListener('touchend', onEnd);
      dialog.removeEventListener('touchcancel', onEnd);
    };
  }, [dialogRef, moveRef, waitExit]);
}
