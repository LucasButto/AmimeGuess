'use client';

import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { STORAGE_PREFIX, getLocalStorage } from '@/engine/storage';
import { es } from '@/i18n/es';
import { Button } from './ui/Button';
import { CloseCross } from './ui/CloseCross';

/** Si ya se cerró el aviso (aviso legal y enlace a Créditos): se recuerda en este navegador. */
export const FOOTER_DISMISSED_KEY = `${STORAGE_PREFIX}:footer-dismissed`;

const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

const isDismissed = () => getLocalStorage()?.getItem(FOOTER_DISMISSED_KEY) === '1';

function dismiss(): void {
  try {
    getLocalStorage()?.setItem(FOOTER_DISMISSED_KEY, '1');
  } catch {
    // Sin almacenamiento, se cierra igual hasta que se recargue la página.
  }
  for (const listener of listeners) listener();
}

/** Cómo se cierra el pie; `null` fuera de un `DismissibleFooter` (las páginas cuyo pie no se puede cerrar). */
const DismissContext = createContext<(() => void) | null>(null);

/** La función que cierra el pie, o `null` si este pie no se puede cerrar. La usan los pies de las pieles para dibujar su propia cruz. */
export function useFooterDismiss(): (() => void) | null {
  return useContext(DismissContext);
}

/**
 * El pie de la piel (el aviso de proyecto de fans y el enlace a Créditos), que se puede cerrar: el aviso aparece la primera
 * vez y se puede sacar para que no moleste. Se recuerda la decisión; Créditos sigue en `/creditos`. El servidor lo dibuja
 * siempre (la primera visita lo ve) y, ya en el navegador, se oculta si se había cerrado.
 *
 * Este componente solo se ocupa de cerrar: la cruz la dibuja cada pie por dentro de su propia caja, con su estética
 * (`FooterDismissButton` para los que usan el botón del tema, o un botón propio con `useFooterDismiss`).
 */
export function DismissibleFooter({ children }: { children: ReactNode }) {
  const dismissed = useSyncExternalStore(subscribe, isDismissed, () => false);
  if (dismissed) return null;
  return <DismissContext.Provider value={dismiss}>{children}</DismissContext.Provider>;
}

/** La cruz para cerrar el pie, con el botón del tema (el de "cerrar" de los modales). No se ve donde el pie no se puede cerrar. */
export function FooterDismissButton({ className }: { className?: string }) {
  const onDismiss = useFooterDismiss();
  if (onDismiss === null) return null;
  return (
    <Button variant="icon" tone="b" className={className} aria-label={es.footer.dismiss} onClick={onDismiss}>
      <CloseCross />
    </Button>
  );
}
