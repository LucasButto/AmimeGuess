'use client';

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import styles from './Sheet.module.scss';
import { Panel } from './ui/Panel';
import { useSwipeToClose } from './useSwipeToClose';

interface SheetProps {
  /** Si la hoja está abierta. Al pasar a `false` baja con su transición y recién entonces se desmonta. */
  open: boolean;
  title: string;
  /** Se llama al cerrar con Escape, tocando afuera del cuadro o arrastrándola hacia abajo (quien la usa pone `open` en `false`). */
  onClose: () => void;
  /** Acciones fijas al pie (por ejemplo, un botón "Listo"). */
  footer?: ReactNode;
  children: ReactNode;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Lo que dura la salida (la transición de `Sheet.module.scss`): recién después se desmonta. */
const EXIT_MS = 320;

/**
 * Hoja inferior accesible: sube desde abajo con un fondo oscurecido, un asa arriba, el cuerpo desplazable y las acciones
 * fijas al pie, respetando el área segura. Sobre el `<dialog>` nativo, como `Modal`: el resto de la página queda inerte,
 * Escape y un toque afuera la cierran, el foco queda atrapado adentro y vuelve a quien la abrió. En el teléfono se cierra
 * también arrastrándola hacia abajo con el dedo (la sigue mientras no se suelta; ver `useSwipeToClose`). Desde `lg` es un
 * cuadro centrado. Siempre está en el árbol: `open` la abre y la cierra; entra y sale con transiciones (`data-shown`), y al
 * cerrarse se desmonta cuando terminó de salir.
 */
export function Sheet({ open, ...props }: SheetProps) {
  const [present, setPresent] = useState(open);
  const exited = useCallback(() => setPresent(false), []);
  // Al abrirse se monta; al cerrarse se queda montada hasta que termina de bajar.
  if (open && !present) setPresent(true);
  if (!present) return null;
  return <SheetDialog {...props} closing={!open} onExited={exited} />;
}

function SheetDialog({ title, onClose, footer, children, closing, onExited }: Omit<SheetProps, 'open'> & { closing: boolean; onExited: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Lo que sube, baja y sigue al dedo es el panel, no el <dialog>: así las ayudas ⓘ (fijas, montadas en el diálogo) siguen
  // ubicándose respecto de la ventana.
  const panelRef = useRef<HTMLElement>(null);
  const unmounting = useRef(false);
  const titleId = useId();
  // Se marca apenas después de abrirse, así la transición de entrada parte de abajo.
  const [entered, setEntered] = useState(false);
  useSwipeToClose(dialogRef, onClose, { moveRef: panelRef });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    unmounting.current = false;
    dialog.showModal();
    // Fuerza el cálculo de estilos con la hoja abajo: así `data-shown`, en la tarea siguiente, siempre la hace subir.
    void dialog.getBoundingClientRect();
    const timer = setTimeout(() => setEntered(true), 0);
    return () => {
      clearTimeout(timer);
      // Cerrarla dispara el evento `close`: acá lo provoca el desmontaje, no la persona.
      unmounting.current = true;
      if (dialog.open) dialog.close();
      opener?.focus();
    };
  }, []);

  // Al cerrarse se desmonta cuando terminó la transición de salida (enseguida con movimiento reducido). Si vuelve a abrirse
  // antes, se borra lo que haya dejado un arrastre y entra de nuevo.
  useEffect(() => {
    const dialog = dialogRef.current;
    const panel = panelRef.current;
    if (!closing) {
      if (dialog && panel && !dialog.hasAttribute('data-dragging')) {
        panel.style.transition = '';
        panel.style.transform = '';
        dialog.style.removeProperty('--swipe-progress');
      }
      return;
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = setTimeout(onExited, reduced ? 0 : EXIT_MS);
    return () => clearTimeout(timer);
  }, [closing, onExited]);

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
      data-shown={entered && !closing ? '' : undefined}
      aria-labelledby={titleId}
      onKeyDown={handleKeyDown}
      // Escape: el navegador la cerraría de golpe; se la deja bajar con su transición.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={() => {
        // Se ignora si lo provocó el desmontaje o si ya se volvió a abrir (en desarrollo React monta los efectos dos veces).
        if (!unmounting.current && !dialogRef.current?.open) onClose();
      }}
      // Un toque sobre el fondo llega al propio <dialog>, no a su contenido.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <Panel ref={panelRef} variant="dialog" className={styles.panel}>
        <span className={styles.handle} aria-hidden="true" />
        <header className={styles.header} data-part="sheet-header">
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
