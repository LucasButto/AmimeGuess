'use client';

import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import styles from './Sheet.module.scss';
import { Panel } from './ui/Panel';
import { useSwipeToClose } from './useSwipeToClose';

interface SheetProps {
  title: string;
  /** Se llama al cerrar con Escape, tocando afuera del cuadro o desde adentro (el botón de `footer`). Quien lo usa deja de montarla. */
  onClose: () => void;
  /** Acciones fijas al pie (por ejemplo, un botón "Listo"). */
  footer?: ReactNode;
  children: ReactNode;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Hoja inferior accesible: sube desde abajo con un fondo oscurecido, un asa arriba, el cuerpo desplazable y las acciones
 * fijas al pie, respetando el área segura. Sobre el `<dialog>` nativo, como `Modal`: el resto de la página queda inerte,
 * Escape y un toque afuera la cierran, el foco queda atrapado adentro y vuelve a quien la abrió. Desde `lg` es un cuadro
 * centrado. Se monta solo mientras está abierta: `{abierta && <Sheet …>}`.
 */
export function Sheet({ title, onClose, footer, children }: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const unmounting = useRef(false);
  const titleId = useId();
  const swipe = useSwipeToClose(dialogRef, onClose);
  // El asa y el encabezado se arrastran hacia abajo para cerrar.
  const swipeHandlers = {
    onPointerDown: swipe.start,
    onPointerMove: swipe.move,
    onPointerUp: swipe.end,
    onPointerCancel: swipe.end,
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    unmounting.current = false;
    dialog.showModal();
    return () => {
      // Cerrarla dispara el evento `close`: acá lo provoca el desmontaje, no la persona.
      unmounting.current = true;
      if (dialog.open) dialog.close();
      opener?.focus();
    };
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

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      data-sheet=""
      aria-labelledby={titleId}
      onKeyDown={handleKeyDown}
      onClose={() => {
        // Se ignora si lo provocó el desmontaje o si ya se volvió a abrir (en desarrollo React monta los efectos dos veces).
        if (!unmounting.current && !dialogRef.current?.open) onClose();
      }}
      // Un toque sobre el fondo oscurecido llega al propio <dialog>, no a su contenido.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <Panel variant="dialog" className={styles.panel}>
        <span className={styles.handle} aria-hidden="true" {...swipeHandlers} />
        <header className={styles.header} data-part="sheet-header" {...swipeHandlers}>
          <h2 className={styles.title} id={titleId}>
            {title}
          </h2>
        </header>
        <div className={styles.body} data-part="sheet-body">
          {children}
        </div>
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </Panel>
    </dialog>
  );
}
