'use client';

import { createContext, useContext, useEffect, useState, type Ref } from 'react';
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
