'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useAppShell } from './AppShellContext';
import styles from './SheetSlot.module.scss';

/**
 * Dónde va lo que el diseño de app saca de la página y mete en la hoja de filtros (`Sheet`): `phone` dice si estamos en la
 * disposición del teléfono (la barra inferior tiene caja) y `target` es el lugar de la hoja, mientras está abierta.
 */
export const SheetSlotContext = createContext<{ phone: boolean; target: HTMLElement | null } | null>(null);

type SectionChildren = ReactNode | ((inSheet: boolean) => ReactNode);

/**
 * Una parte del juego que en el teléfono vive en la hoja de filtros (los filtros, la dificultad, "Qué comparar") y en lo
 * demás sigue en su lugar. Sin diseño de app devuelve exactamente sus hijos. Con él, hasta saber si es un teléfono el
 * CSS la oculta (así no parpadea), y en el teléfono se dibuja solo adentro de la hoja abierta. `children` puede ser una
 * función para dibujar distinto adentro de la hoja.
 */
export function SheetSection({ children }: { children: SectionChildren }) {
  const appShell = useAppShell();
  const slot = useContext(SheetSlotContext);
  const render = (inSheet: boolean) => (typeof children === 'function' ? children(inSheet) : children);
  if (!appShell || !slot) return <>{render(false)}</>;
  return (
    <>
      <div className={styles.source}>{!slot.phone && render(false)}</div>
      {slot.phone && slot.target && createPortal(render(true), slot.target)}
    </>
  );
}
