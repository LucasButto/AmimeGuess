'use client';

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { es } from '@/i18n/es';
import styles from './Modal.module.scss';
import { Button } from './ui/Button';
import { CloseCross } from './ui/CloseCross';
import { Panel } from './ui/Panel';

/** Cuánto está corrido un modal movible desde el centro, en píxeles. */
export interface ModalOffset {
  readonly x: number;
  readonly y: number;
}

/** El tamaño de un modal que se puede agrandar y achicar, en píxeles. */
export interface ModalSize {
  readonly width: number;
  readonly height: number;
}

/** Lo más chico que se puede dejar un modal redimensionable, en `rem` (con menos, la grilla y los botones no entran). */
const MIN_WIDTH_REM = 28;
const MIN_HEIGHT_REM = 28.5;
/** Lo que queda libre entre el cuadro y el borde de la pantalla al agrandarlo, en píxeles. */
const EDGE_GAP = 8;

interface ModalProps {
  title: string;
  /** Se llama al cerrar con Escape, con el botón o tocando fuera del cuadro. Quien lo usa deja de montar el modal. */
  onClose: () => void;
  /** Un cuadro más ancho en pantallas grandes, para contenido en grilla (por ejemplo, el selector de la Pokédex). */
  wide?: boolean;
  /** Clase del `<dialog>`: sirve para redefinir tokens del tema solo en este modal (por ejemplo, el color de la barra del título). */
  className?: string;
  /**
   * Con esto, el cuadro se puede arrastrar desde la barra del título, como una nota, para ver lo que hay detrás (solo
   * cuando es un cuadro centrado: a pantalla completa no hay adónde llevarlo). `offset` es dónde está; quien lo usa
   * lo guarda con `onMove` (al soltarlo), así al volver a abrirlo aparece donde se dejó.
   */
  offset?: ModalOffset;
  onMove?: (offset: ModalOffset) => void;
  /**
   * Con esto, el cuadro centrado también se puede agrandar y achicar desde la esquina de abajo a la derecha, entre un
   * mínimo (28 × 28,5 rem: una fila completa de tres Pokémon, con el buscador y los botones) y el borde de la pantalla. `size` es el último
   * tamaño (sin él, el de siempre). Al soltar, `onResize` avisa el tamaño y el corrimiento nuevos: la esquina de
   * arriba a la izquierda queda donde estaba, así que cambian los dos.
   */
  size?: ModalSize;
  onResize?: (size: ModalSize, offset: ModalOffset) => void;
  /** Alto mínimo al achicarlo, en `rem` (por defecto 28,5). */
  minHeightRem?: number;
  /** Un adorno a la izquierda del título, en la barra (por ejemplo, la lente y las luces de la Pokédex). Decorativo. */
  decoration?: ReactNode;
  children: ReactNode;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Lo que tiene que quedar a la vista del cuadro, a lo ancho, para poder volver a agarrarlo (en píxeles). */
const KEEP_VISIBLE = 96;

const ORIGIN: ModalOffset = { x: 0, y: 0 };

/** Lo que hace falta durante un cambio de tamaño: desde dónde y con qué tamaño empezó. */
interface Resize {
  pointerId: number;
  startX: number;
  startY: number;
  from: ModalOffset;
  start: ModalSize;
  /** El tamaño y el corrimiento de ahora: lo que se guarda al soltar. */
  last: { size: ModalSize; offset: ModalOffset };
  /** Hasta dónde puede crecer (el borde de la pantalla) y lo mínimo, en píxeles. */
  max: ModalSize;
  min: ModalSize;
}

/** Lo que hace falta durante un arrastre: dónde empezó el puntero, desde qué corrimiento y dónde está el cuadro sin correr. */
interface Drag {
  pointerId: number;
  startX: number;
  startY: number;
  from: ModalOffset;
  /** El último corrimiento: el que se guarda al soltar. */
  last: ModalOffset;
  base: DOMRect;
  headerHeight: number;
}

/** Un corrimiento que deja la barra del título adentro de la pantalla (y al menos un pedazo del cuadro a lo ancho). */
function clampOffset(offset: ModalOffset, base: DOMRect, headerHeight: number): ModalOffset {
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
  return {
    x: clamp(offset.x, KEEP_VISIBLE - base.right, window.innerWidth - KEEP_VISIBLE - base.left),
    y: clamp(offset.y, -base.top, window.innerHeight - headerHeight - base.top),
  };
}

/** El rectángulo del cuadro como si no estuviera corrido. */
function baseRect(dialog: HTMLElement, offset: ModalOffset): DOMRect {
  const rect = dialog.getBoundingClientRect();
  return new DOMRect(rect.left - offset.x, rect.top - offset.y, rect.width, rect.height);
}

/**
 * Diálogo modal accesible, sobre el elemento `<dialog>` nativo.
 *
 * - El resto de la página queda inerte mientras está abierto.
 * - Escape lo cierra.
 * - El foco queda atrapado adentro (Tab y Shift+Tab dan la vuelta) y, al
 *   cerrarse, vuelve al elemento que lo abrió.
 * - En un teléfono ocupa toda la pantalla y el botón "Cerrar" queda abajo, al
 *   alcance del pulgar; desde `md` es un cuadro centrado.
 * - Con `onMove`, el cuadro centrado se puede arrastrar desde la barra del título, y la página de atrás se puede
 *   desplazar con la rueda (fuera del cuadro): se ve, aunque no se puede tocar.
 * - Con `onResize`, también se puede agrandar y achicar desde la esquina de abajo a la derecha, con un mínimo.
 *
 * Se monta solo mientras está abierto: `{abierto && <Modal …>}`.
 */
export function Modal({ title, onClose, wide = false, className, offset, onMove, size, onResize, minHeightRem = MIN_HEIGHT_REM, decoration, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const unmounting = useRef(false);
  const titleId = useId();
  const movable = onMove !== undefined;
  const [position, setPosition] = useState<ModalOffset>(offset ?? ORIGIN);
  const dragRef = useRef<Drag | null>(null);
  const [dragging, setDragging] = useState(false);
  const resizable = onResize !== undefined;
  const [dims, setDims] = useState<ModalSize | null>(size ?? null);
  const resizeRef = useRef<Resize | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    unmounting.current = false;
    dialog.showModal();

    return () => {
      // Cerrarlo dispara el evento `close`: acá lo provoca el desmontaje, no la persona.
      unmounting.current = true;
      if (dialog.open) dialog.close();
      opener?.focus();
    };
  }, []);

  // Al abrirse donde se lo dejó: si la ventana cambió de tamaño desde entonces, se lo trae para que se pueda agarrar.
  useEffect(() => {
    const dialog = dialogRef.current;
    const start = offset ?? ORIGIN;
    if (!movable || !dialog || (start.x === 0 && start.y === 0)) return;
    const fitted = clampOffset(start, baseRect(dialog, start), headerRef.current?.offsetHeight ?? 0);
    if (fitted.x !== start.x || fitted.y !== start.y) setPosition(fitted);
    // Solo al abrirse: después lo mueve la persona.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') return;
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;

    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  // --- Arrastrar desde la barra del título --------------------------------------------
  function startDrag(event: ReactPointerEvent<HTMLElement>) {
    const dialog = dialogRef.current;
    if (!movable || !dialog || (event.pointerType === 'mouse' && event.button !== 0)) return;
    // El botón de cerrar sigue siendo un botón.
    if (event.target instanceof Element && event.target.closest('button')) return;
    // A pantalla completa (un teléfono) no hay adónde llevarlo.
    if (dialog.getBoundingClientRect().width >= window.innerWidth) return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // El puntero ya no está activo: no hay nada que capturar.
    }
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      from: position,
      last: position,
      base: baseRect(dialog, position),
      headerHeight: event.currentTarget.offsetHeight,
    };
    setDragging(true);
  }

  function moveDrag(event: ReactPointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const next = { x: drag.from.x + event.clientX - drag.startX, y: drag.from.y + event.clientY - drag.startY };
    drag.last = clampOffset(next, drag.base, drag.headerHeight);
    setPosition(drag.last);
  }

  function endDrag(event: ReactPointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    onMove?.(drag.last);
  }

  // --- Agrandar y achicar desde la esquina de abajo a la derecha ----------------------
  function startResize(event: ReactPointerEvent<HTMLElement>) {
    const dialog = dialogRef.current;
    if (!resizable || !dialog || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // El puntero ya no está activo: no hay nada que capturar.
    }
    const rect = dialog.getBoundingClientRect();
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const start = { width: rect.width, height: rect.height };
    resizeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      from: position,
      start,
      last: { size: start, offset: position },
      // Crece hasta el borde de la pantalla (con un poco de aire); nunca baja del mínimo, ni si ya es más chico.
      max: {
        width: Math.max(MIN_WIDTH_REM * rem, window.innerWidth - rect.left - EDGE_GAP),
        height: Math.max(minHeightRem * rem, window.innerHeight - rect.top - EDGE_GAP),
      },
      min: { width: MIN_WIDTH_REM * rem, height: minHeightRem * rem },
    };
    setDragging(true);
  }

  function moveResize(event: ReactPointerEvent<HTMLElement>) {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
    const width = clamp(resize.start.width + event.clientX - resize.startX, resize.min.width, resize.max.width);
    const height = clamp(resize.start.height + event.clientY - resize.startY, resize.min.height, resize.max.height);
    // El cuadro está centrado: al crecer se abre para los dos lados. Se corre la mitad de lo que crece, así la esquina
    // de arriba a la izquierda no se mueve y la de abajo a la derecha sigue al puntero.
    const next = {
      size: { width, height },
      offset: { x: resize.from.x + (width - resize.start.width) / 2, y: resize.from.y + (height - resize.start.height) / 2 },
    };
    resize.last = next;
    setDims(next.size);
    setPosition(next.offset);
  }

  function endResize(event: ReactPointerEvent<HTMLElement>) {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    resizeRef.current = null;
    setDragging(false);
    onResize?.(resize.last.size, resize.last.offset);
  }

  // El corrimiento y el tamaño son valores calculados en cada movimiento: van como variables CSS (los aplica el estilo,
  // solo como cuadro centrado).
  const style = movable
    ? ({
        '--modal-x': `${position.x}px`,
        '--modal-y': `${position.y}px`,
        ...(dims ? { '--modal-w': `${dims.width}px`, '--modal-h': `${dims.height}px` } : {}),
      } as CSSProperties)
    : undefined;

  return (
    <dialog
      ref={dialogRef}
      className={className ? `${styles.dialog} ${className}` : styles.dialog}
      data-wide={wide}
      data-movable={movable}
      data-resizable={resizable}
      data-sized={dims !== null}
      data-dragging={dragging}
      style={style}
      aria-labelledby={titleId}
      onKeyDown={handleKeyDown}
      onClose={() => {
        // El evento llega después de cerrarse. Se ignora si lo provocó el desmontaje o si el diálogo ya se
        // volvió a abrir (en desarrollo, React monta los efectos dos veces: el `close` del primer desmontaje
        // llega con el diálogo abierto de nuevo).
        if (!unmounting.current && !dialogRef.current?.open) onClose();
      }}
      // Un clic sobre el fondo oscuro llega al propio <dialog>, no a su contenido.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      // Con un modal movible, la rueda fuera del cuadro mueve la página de atrás. El navegador no lo hace solo: el
      // fondo es del <dialog>, que está fijo, y la página quedó inerte.
      onWheel={(event) => {
        if (!movable || event.target !== event.currentTarget) return;
        const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
        window.scrollBy({ left: event.deltaX * unit, top: event.deltaY * unit });
      }}
    >
      {/* El cuadro es un Panel de diálogo: el tema le da su marco. El <dialog> solo lo ubica. */}
      <Panel variant="dialog" className={styles.panel}>
        <header
          ref={headerRef}
          className={styles.header}
          data-part="modal-header"
          title={movable ? es.shell.dragHint : undefined}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {decoration}
          <h2 className={styles.title} id={titleId} data-part="modal-title">
            {title}
          </h2>
          <Button variant="icon" tone="b" aria-label={es.shell.close} onClick={onClose}>
            <CloseCross />
          </Button>
        </header>
        <div className={styles.body} data-part="modal-body">{children}</div>
        <footer className={styles.footer}>
          <Button className={styles.close} onClick={onClose}>
            {es.shell.close}
          </Button>
        </footer>
      </Panel>
      {resizable && (
        <span className={styles.grip} aria-hidden="true" title={es.shell.resizeHint} onPointerDown={startResize} onPointerMove={moveResize} onPointerUp={endResize} onPointerCancel={endResize} />
      )}
    </dialog>
  );
}
