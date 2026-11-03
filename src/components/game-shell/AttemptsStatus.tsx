'use client';

import { createContext, useCallback, useContext, useId, useState, type ReactNode, type RefCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAppShell } from './AppShellContext';
import styles from './AttemptsStatus.module.scss';

const StatusContext = createContext<{
  target: HTMLDivElement | null;
  attach: RefCallback<HTMLDivElement>;
  id: string;
} | null>(null);

/** The CSS-hidden desktop destination returns the original children to their board. */
export function AttemptsStatusProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const id = useId();
  const attach = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const update = () => setTarget(node.getClientRects().length ? node : null);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => { observer.disconnect(); setTarget(null); };
  }, []);
  return <StatusContext.Provider value={{ target, attach, id }}>{children}</StatusContext.Provider>;
}

export function AttemptsStatusTarget() {
  const context = useContext(StatusContext);
  return <div id={context?.id} ref={context?.attach} className={styles.target} />;
}

/** No wrapper and no duplicated counter when disabled or on desktop. */
export function AttemptsStatus({ children }: { children: ReactNode }) {
  const appShell = useAppShell();
  const context = useContext(StatusContext);
  return appShell && context?.target ? createPortal(children, context.target) : <>{children}</>;
}
