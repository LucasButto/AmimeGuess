'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { flushSync } from 'react-dom';
import { moveToRank } from '@/modes/timeline/logic';
import type { Block } from './draft';

// Ordenar las tarjetas de la sala (Crear sala): se arrastran con el puntero (el dedo, solo desde el asa; el mouse, desde toda la
// tarjeta) en una lista de una o dos columnas, y al reordenarse por cualquier vía (arrastre o flechitas) las tarjetas se deslizan
// hasta su lugar nuevo (animación FLIP: solo `transform`, y quieta con movimiento reducido).

const NO_LOCKS: ReadonlySet<number> = new Set();
const SLIDE_MS = 240;

interface DragState {
  id: string;
  /** Distancia entre el puntero y la esquina de arriba a la izquierda de la tarjeta al agarrarla. */
  grabX: number;
  grabY: number;
  /** Posición del puntero respecto de la esquina de arriba a la izquierda de la lista. */
  pointerX: number;
  pointerY: number;
  pointerId: number;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Desliza una tarjeta desde donde estaba (`dx`, `dy` píxeles) hasta su lugar. Solo `transform`. */
function slide(element: HTMLElement, dx: number, dy: number): void {
  element.style.transition = 'none';
  element.style.transform = `translate(${dx}px, ${dy}px)`;
  void element.offsetHeight;
  element.style.transition = `transform ${SLIDE_MS}ms cubic-bezier(0.25, 0.8, 0.3, 1)`;
  element.style.transform = '';
  const clear = () => {
    element.style.transition = '';
    element.removeEventListener('transitionend', clear);
  };
  element.addEventListener('transitionend', clear);
}

export interface BlockReorder {
  readonly listRef: (element: HTMLOListElement | null) => void;
  readonly registerItem: (id: string, element: HTMLLIElement | null) => void;
  readonly draggingId: string | null;
  readonly startDrag: (event: ReactPointerEvent, id: string) => void;
}

export function useBlockReorder(blocks: readonly Block[], setBlocks: (next: readonly Block[]) => void): BlockReorder {
  const listEl = useRef<HTMLOListElement | null>(null);
  const listRef = useCallback((element: HTMLOListElement | null) => {
    listEl.current = element;
  }, []);
  const itemRefs = useRef(new Map<string, HTMLLIElement>());
  const places = useRef(new Map<string, { x: number; y: number }>());
  const dragRef = useRef<DragState | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const blocksRef = useRef(blocks);
  const setBlocksRef = useRef(setBlocks);
  const draggingRef = useRef<string | null>(null);

  const registerItem = useCallback((id: string, element: HTMLLIElement | null) => {
    if (element) itemRefs.current.set(id, element);
    else itemRefs.current.delete(id);
  }, []);

  useEffect(() => {
    blocksRef.current = blocks;
    setBlocksRef.current = setBlocks;
    draggingRef.current = draggingId;
  });

  // La animación: después de cada cambio de orden (o de alta y baja de tarjetas), cada una que cambió de lugar vuelve a su sitio
  // nuevo deslizándose desde donde estaba. La que se arrastra sigue al puntero y no se anima.
  useLayoutEffect(() => {
    const reduced = prefersReducedMotion();
    const next = new Map<string, { x: number; y: number }>();
    for (const [id, element] of itemRefs.current) {
      const place = { x: element.offsetLeft, y: element.offsetTop };
      next.set(id, place);
      const before = places.current.get(id);
      if (reduced || before === undefined || (before.x === place.x && before.y === place.y) || id === draggingRef.current) continue;
      slide(element, before.x - place.x, before.y - place.y);
    }
    places.current = next;
  }, [blocks]);

  /** Pone a la tarjeta arrastrada donde está el puntero (valores calculados en cada movimiento: van como variables CSS). */
  const applyDrag = useCallback(() => {
    const drag = dragRef.current;
    const element = drag ? itemRefs.current.get(drag.id) : undefined;
    if (!drag || !element) return;
    element.style.setProperty('--drag-x', `${drag.pointerX - drag.grabX - element.offsetLeft}px`);
    element.style.setProperty('--drag-y', `${drag.pointerY - drag.grabY - element.offsetTop}px`);
  }, []);

  const startDrag = useCallback((event: ReactPointerEvent, id: string) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const element = itemRefs.current.get(id);
    const list = listEl.current;
    if (!element || !list) return;
    event.preventDefault();
    const rect = element.getBoundingClientRect();
    const box = list.getBoundingClientRect();
    dragRef.current = {
      id,
      grabX: event.clientX - rect.left,
      grabY: event.clientY - rect.top,
      pointerX: event.clientX - box.left,
      pointerY: event.clientY - box.top,
      pointerId: event.pointerId,
    };
    // La lista no se mueve: al reordenar, React puede mover el asa que el dedo tiene agarrada y sin esto algunos navegadores
    // táctiles dejarían de mandar eventos.
    try {
      list.setPointerCapture(event.pointerId);
    } catch {
      // El puntero ya no está activo.
    }
    setDraggingId(id);
  }, []);

  useEffect(() => {
    if (draggingId === null) return;

    function onMove(event: PointerEvent) {
      const drag = dragRef.current;
      const list = listEl.current;
      const element = drag ? itemRefs.current.get(drag.id) : undefined;
      if (!drag || !list || !element) return;
      const box = list.getBoundingClientRect();
      drag.pointerX = event.clientX - box.left;
      drag.pointerY = event.clientY - box.top;
      applyDrag();
      const current = blocksRef.current;
      const ids = current.map((block) => block.id);
      // La tarjeta que está bajo el puntero (sin contar la que se arrastra): ahí queda la arrastrada.
      const target = ids.find((id) => {
        const other = itemRefs.current.get(id);
        if (id === drag.id || !other) return false;
        return drag.pointerX >= other.offsetLeft && drag.pointerX <= other.offsetLeft + other.offsetWidth && drag.pointerY >= other.offsetTop && drag.pointerY <= other.offsetTop + other.offsetHeight;
      });
      if (target === undefined) return;
      const moved = moveToRank(ids, NO_LOCKS, drag.id, ids.indexOf(target));
      if (moved && moved.some((id, index) => id !== ids[index])) {
        const byId = new Map(current.map((block) => [block.id, block]));
        const reordered = moved.flatMap((id) => (byId.has(id) ? [byId.get(id) as Block] : []));
        blocksRef.current = reordered;
        // Al instante: si llega otro movimiento antes de que React dibuje, tiene que medir sobre la lista ya reordenada.
        flushSync(() => setBlocksRef.current(reordered));
        applyDrag();
      }
    }

    function onEnd() {
      const drag = dragRef.current;
      if (drag) {
        try {
          listEl.current?.releasePointerCapture(drag.pointerId);
        } catch {
          // Ya se soltó sola al terminar el gesto.
        }
        const element = itemRefs.current.get(drag.id);
        element?.style.removeProperty('--drag-x');
        element?.style.removeProperty('--drag-y');
      }
      dragRef.current = null;
      setDraggingId(null);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
  }, [draggingId, applyDrag]);

  return { listRef, registerItem, draggingId, startDrag };
}
