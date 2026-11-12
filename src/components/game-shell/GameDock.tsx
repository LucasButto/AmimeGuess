'use client';

import { createContext, useContext, useEffect, useState, type ReactNode, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { useAppShell } from './AppShellContext';
import { GAME_DOCK_ID } from './dockId';
import styles from './GameDock.module.scss';

/**
 * La barra inferior donde monta la acción principal, o `null` si no corresponde (sin diseño de app, o desde `lg`, donde
 * el CSS la oculta y la acción se queda en el tablero). Lo decide el CSS: la barra está visible solo si tiene caja.
 */
export function useDockTarget(): HTMLElement | null {
  const appShell = useAppShell();
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const dock = appShell ? document.getElementById(GAME_DOCK_ID) : null;
    if (!dock) return;
    const update = () => setTarget(dock.getClientRects().length ? dock : null);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(dock);
    return () => {
      observer.disconnect();
      setTarget(null);
    };
  }, [appShell]);

  return target;
}

/**
 * El teclado del teléfono tapa la barra inferior en iOS (que no achica la página, solo la parte visible). Mientras el campo
 * está en la barra, `--dock-lift` dice cuánto subirla para que quede pegada al teclado; la barra la lee (ver `.dock`).
 * Las listas del dock usan el alto visible para que se puedan desplazar por encima del teclado.
 * En Android, con `interactive-widget=resizes-content` (ver `src/app/layout.tsx`), la página se achica sola y vale 0.
 */
export function useDockKeyboardLift(active: boolean): void {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!active || !viewport) return;
    const root = document.documentElement;
    const update = () => {
      const lift = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      root.style.setProperty('--dock-lift', `${Math.round(lift)}px`);
      root.style.setProperty('--dock-viewport-height', `${Math.floor(viewport.height)}px`);
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      root.style.removeProperty('--dock-lift');
      root.style.removeProperty('--dock-viewport-height');
    };
  }, [active]);
}

/** `true` para lo que se monta dentro de la barra inferior: lo usa el selector del tema para dibujarse como botón del dock. */
export const InDockContext = createContext(false);
export const useInDock = () => useContext(InDockContext);

interface DockActionProps {
  /** Lo que hace el botón, en una palabra o dos ("Siguiente", "Detener"). */
  label: string;
  /** Una línea más chica debajo (por ejemplo, qué hay que hacer a continuación). */
  detail?: string;
  onClick: () => void;
  disabled?: boolean;
  buttonRef?: Ref<HTMLButtonElement>;
}

/**
 * La acción principal de un modo sin campo de texto (Siguiente, Detener…) como botón grande de la barra inferior. Sin
 * barra (escritorio, o sin el diseño de app) no dibuja nada: la acción se queda en el tablero. Quien la usa decide con
 * `useDockTarget()` si además esconde su propio botón del tablero.
 */
export function DockAction({ label, detail, onClick, disabled, buttonRef }: DockActionProps) {
  const target = useDockTarget();
  if (!target) return null;
  return createPortal(
    <button type="button" ref={buttonRef} className={styles.action} disabled={disabled} onClick={onClick} data-dock-action="">
      <span className={styles.label}>{label}</span>
      {detail && <span className={styles.detail}>{detail}</span>}
    </button>,
    target,
  );
}

export interface DockButton {
  /** El nombre de la acción: se lee y se muestra como texto, salvo que lleve `icon` (entonces solo se lee). */
  label: string;
  /** Un ícono en lugar del texto, para las acciones secundarias cortas (el botón mide lo justo y el principal se queda con el resto). */
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  /** La acción principal (más ancha y con el color de la barra); las demás son secundarias. */
  primary?: boolean;
}

/** Varias acciones en la barra inferior (por ejemplo, Mezclar, Deseleccionar y Enviar). Sin barra, no dibuja nada. */
export function DockActions({ buttons }: { buttons: readonly DockButton[] }) {
  const target = useDockTarget();
  if (!target) return null;
  return createPortal(
    <div className={styles.group} data-dock-actions="">
      {buttons.map((button) => (
        <button
          key={button.label}
          type="button"
          className={button.primary ? styles.action : styles.secondary}
          data-primary={button.primary || undefined}
          data-icon={button.icon ? '' : undefined}
          aria-label={button.icon ? button.label : undefined}
          disabled={button.disabled}
          onClick={button.onClick}
        >
          {button.icon ? <span className={styles.icon} aria-hidden="true">{button.icon}</span> : <span className={styles.label}>{button.label}</span>}
        </button>
      ))}
    </div>,
    target,
  );
}
