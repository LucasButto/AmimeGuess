'use client';

import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { STORAGE_PREFIX, getLocalStorage } from '@/engine/storage';
import { es } from '@/i18n/es';
import styles from './DismissibleFooter.module.scss';
import { Button } from './ui/Button';
import { CloseCross } from './ui/CloseCross';

/** Teléfono (diseño de app): si ya se mostró el aviso una vez. A partir de ahí no vuelve a aparecer en el teléfono. */
export const FOOTER_SEEN_PHONE_KEY = `${STORAGE_PREFIX}:footer-seen-phone`;

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

const subscribeNever = () => () => undefined;

/** Lo que ya se sabía de esta visita al abrir la página (se lee una sola vez: navegar entre páginas no la cambia). */
let seenAtLoad: boolean | null = null;

/**
 * Teléfono: ¿el aviso ya se mostró en una visita anterior? La primera vez que se pregunta lo marca como mostrado, y esa
 * respuesta queda fija hasta recargar, así que durante la primera visita el aviso no desaparece. Fuera del teléfono, `false`.
 */
function readSeenOnPhone(): boolean {
  if (seenAtLoad !== null) return seenAtLoad;
  if (!window.matchMedia('(max-width: 63.99rem)').matches) return false;
  const storage = getLocalStorage();
  let seen = false;
  try {
    seen = storage?.getItem(FOOTER_SEEN_PHONE_KEY) === '1';
    if (!seen) storage?.setItem(FOOTER_SEEN_PHONE_KEY, '1');
  } catch {
    // Sin almacenamiento, el aviso se muestra como siempre.
  }
  seenAtLoad = seen;
  return seen;
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
export function DismissibleFooter({ children, phoneOnce = false }: { children: ReactNode; phoneOnce?: boolean }) {
  const dismissed = useSyncExternalStore(subscribe, isDismissed, () => false);
  // Diseño de app: en el teléfono el aviso se ve en la primera visita y después queda en Créditos.
  const seenOnPhone = useSyncExternalStore(subscribeNever, phoneOnce ? readSeenOnPhone : () => false, () => false);
  if (dismissed) return null;
  const footer = <DismissContext.Provider value={dismiss}>{children}</DismissContext.Provider>;
  return phoneOnce ? <div className={seenOnPhone ? styles.phoneHidden : styles.shown}>{footer}</div> : footer;
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
