'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useSkin } from '../skin/context';
import { PixelIcon } from './icons';
import styles from './InfoTip.module.scss';

interface InfoTipProps {
  /** El texto de ayuda (de `es.help.*`, 140 caracteres como mucho). */
  text: string;
  /** Contenido visual de la ayuda, montado al abrirla. */
  preview?: ReactNode;
  /** Nombre accesible del botón ("Ayuda: Tipo 1"); el texto largo va en el recuadro, nunca acá. Con `children` y sin esto, el nombre es el texto. */
  label?: string;
  /** En lugar del ícono ⓘ, un texto que abre el recuadro (un término subrayado a puntos): su nombre accesible es ese texto. */
  children?: ReactNode;
  /** Junto a un texto (un título, un encabezado de tabla): ocupa menos lugar sin achicar el área táctil. */
  compact?: boolean;
  /** Diseño de app (teléfono): la ayuda no va en la pantalla de juego; su contenido está en "Cómo se juega". Desde `lg` vuelve. */
  hideInApp?: boolean;
  /** El puntero sobre el contenedor inmediato también abre la ayuda. */
  hoverParent?: boolean;
  className?: string;
}

/** Margen mínimo entre el recuadro y el borde de la ventana. */
const EDGE = 8;
/**
 * Al enfocar un botón fuera de la vista, el navegador desplaza la página para mostrarlo: ese desplazamiento
 * (en este tiempo desde que se abrió) reubica el recuadro en vez de cerrarlo.
 */
const OPENING_SCROLL_MS = 300;
/** Demora antes de abrir con el cursor encima, y antes de cerrar al salir (para poder pasar al recuadro). */
const HOVER_OPEN_MS = 120;
const HOVER_CLOSE_MS = 150;

/** Solo una ayuda abierta a la vez: abrir una cierra la anterior. */
let closeOpen: (() => void) | null = null;

interface Placement {
  readonly top: number;
  readonly left: number;
  readonly side: 'above' | 'below';
  /** Dónde queda la flecha, desde el borde izquierdo del recuadro. */
  readonly arrow: number;
}

/**
 * Botón ⓘ con un recuadro de ayuda (SPEC 9.2). El área táctil mide 44 × 44 px aunque el dibujo sea más
 * chico. Se abre con el cursor encima (solo con un puntero que pueda pasar por encima, tras 120 ms), al
 * enfocarlo con el teclado y al tocarlo (alterna); se cierra con Escape, al tocar o hacer clic afuera, al
 * perder el foco, al desplazar y al rotar. Cumple WCAG 1.4.13: se descarta con Escape sin mover el puntero,
 * el puntero puede pasar sobre el recuadro sin que desaparezca, y sigue abierto hasta que se lo cierra.
 *
 * El recuadro (`role="tooltip"`, enlazado con `aria-describedby`) se monta en el elemento raíz del tema (o
 * en el diálogo abierto que contiene al botón), con posición fija: nunca queda recortado dentro de un
 * contenedor con desplazamiento, como la tabla del Clásico.
 */
export function InfoTip({ text, preview, label, children, compact = false, hideInApp = false, hoverParent = false, className }: InfoTipProps) {
  const tipId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const { root } = useSkin();
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [host, setHost] = useState<Element | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // El último toque o clic sobre el botón: el foco que provoca no tiene que volver a abrir lo que el clic cierra.
  const pointerDown = useRef(false);
  // Cómo se abrió: con el cursor encima se cierra al salir; con un clic, un toque o el teclado, no.
  const openedBy = useRef<'hover' | 'other'>('other');
  const openedAt = useRef(0);

  const close = useCallback(() => {
    clearTimeout(timer.current);
    setOpen(false);
    setPlacement(null);
  }, []);

  const show = useCallback((by: 'hover' | 'other' = 'other') => {
    clearTimeout(timer.current);
    openedBy.current = by;
    openedAt.current = performance.now();
    if (closeOpen && closeOpen !== close) closeOpen();
    closeOpen = close;
    // Dentro de un <dialog> abierto, el recuadro va en el diálogo (capa superior); si no, en la raíz del tema.
    setHost(buttonRef.current?.closest('dialog[open]') ?? root ?? document.body);
    setOpen(true);
  }, [close, root]);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if (closeOpen === close) closeOpen = null;
    },
    [close],
  );

  // Ubicación: arriba o abajo del botón según el espacio, entero dentro de la ventana.
  const place = useCallback(() => {
    const anchor = buttonRef.current;
    const tipElement = tipRef.current;
    if (!anchor || !tipElement) return;
    const button = anchor.getBoundingClientRect();
    const icon = iconRef.current?.getBoundingClientRect() ?? button;
    const anchorX = icon.left + icon.width / 2;
    const tip = tipElement.getBoundingClientRect();
    const dialog = anchor.closest('dialog[open]')?.getBoundingClientRect();
    const gap = 6;
    const topEdge = Math.max(0, dialog?.top ?? 0) + EDGE;
    const leftEdge = Math.max(0, dialog?.left ?? 0) + EDGE;
    const bottomEdge = Math.min(window.innerHeight, dialog?.bottom ?? Infinity) - EDGE;
    const rightEdge = Math.min(document.documentElement.clientWidth, dialog?.right ?? Infinity) - EDGE;
    const below = button.bottom + gap + tip.height <= bottomEdge || button.top - gap - tip.height < topEdge;
    const top = below ? button.bottom + gap : button.top - gap - tip.height;
    const centered = anchorX - tip.width / 2;
    const left = Math.min(Math.max(leftEdge, centered), Math.max(leftEdge, rightEdge - tip.width));
    const arrow = Math.min(Math.max(12, anchorX - left), tip.width - 12);
    // Un diálogo con translate puede ser el origen de las coordenadas fijas del recuadro.
    setPlacement({
      top: Math.max(topEdge, top) - (tip.top - parseFloat(tipElement.style.top)),
      left: left - (tip.left - parseFloat(tipElement.style.left)),
      side: below ? 'below' : 'above',
      arrow,
    });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  // Mientras está abierto: Escape, un toque afuera, el desplazamiento y los cambios de tamaño lo cierran.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Solo cierra la ayuda: no el diálogo que la contiene, ni nada más.
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !tipRef.current?.contains(target)) close();
    };
    const onScroll = () => {
      if (performance.now() - openedAt.current < OPENING_SCROLL_MS) place();
      else close();
    };
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onPointer, true);
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('resize', close);
    window.addEventListener('orientationchange', close);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('orientationchange', close);
    };
  }, [open, close, place]);

  useEffect(() => {
    const button = buttonRef.current;
    const target = hoverParent ? button?.parentElement : button;
    if (!target) return;
    function enter(event: PointerEvent) {
      if (event.pointerType !== 'mouse' || !window.matchMedia('(hover: hover)').matches) return;
      clearTimeout(timer.current);
      if (!open) timer.current = setTimeout(() => show('hover'), HOVER_OPEN_MS);
    }
    function leave(event: PointerEvent) {
      if (event.pointerType !== 'mouse') return;
      clearTimeout(timer.current);
      if (open && openedBy.current === 'hover') timer.current = setTimeout(close, HOVER_CLOSE_MS);
    }
    target.addEventListener('pointerenter', enter);
    target.addEventListener('pointerleave', leave);
    return () => {
      target.removeEventListener('pointerenter', enter);
      target.removeEventListener('pointerleave', leave);
    };
  }, [close, hoverParent, open, show]);

  const style = placement
    ? ({ top: `${placement.top}px`, left: `${placement.left}px`, '--arrow-x': `${placement.arrow}px` } as CSSProperties)
    : { top: 0, left: 0 };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={[children === undefined ? styles.button : styles.term, hideInApp && styles.hideInApp, className].filter(Boolean).join(' ')}
        data-compact={compact}
        aria-label={label}
        aria-describedby={open ? tipId : undefined}
        aria-expanded={open}
        onPointerDown={() => {
          pointerDown.current = true;
        }}
        onFocus={(event) => {
          // El foco del teclado lo abre; el de un toque lo maneja el clic.
          if (!pointerDown.current && event.currentTarget.matches(':focus-visible')) show();
        }}
        onBlur={() => {
          pointerDown.current = false;
          close();
        }}
        onClick={() => {
          pointerDown.current = false;
          // Un clic sobre una ayuda que abrió el cursor la deja fija; si no, alterna.
          if (open && openedBy.current === 'hover') openedBy.current = 'other';
          else if (open) close();
          else show();
        }}
      >
        {children === undefined ? (
          <span ref={iconRef} className={styles.dot} aria-hidden="true">
            <PixelIcon name="info" />
          </span>
        ) : (
          children
        )}
      </button>
      {open &&
        host &&
        createPortal(
          <div
            ref={tipRef}
            id={tipId}
            role="tooltip"
            className={styles.tip}
            data-side={placement?.side ?? 'below'}
            data-placed={placement !== null}
            style={style}
            onPointerEnter={() => clearTimeout(timer.current)}
            onPointerLeave={(event) => {
              if (event.pointerType === 'mouse' && openedBy.current === 'hover') timer.current = setTimeout(close, HOVER_CLOSE_MS);
            }}
          >
            {preview}
            {text}
            <span className={styles.arrow} aria-hidden="true" />
          </div>,
          host,
        )}
    </>
  );
}
