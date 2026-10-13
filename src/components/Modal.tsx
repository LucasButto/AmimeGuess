'use client';

import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { es } from '@/i18n/es';
import styles from './Modal.module.scss';
import { Button } from './ui/Button';
import { Panel } from './ui/Panel';

interface ModalProps {
  title: string;
  /** Se llama al cerrar con Escape, con el botón o tocando fuera del cuadro. Quien lo usa deja de montar el modal. */
  onClose: () => void;
  /** Un cuadro más ancho en pantallas grandes, para contenido en grilla (por ejemplo, el selector de la Pokédex). */
  wide?: boolean;
  /** Clase del `<dialog>`: sirve para redefinir tokens del tema solo en este modal (por ejemplo, el color de la barra del título). */
  className?: string;
  children: ReactNode;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Diálogo modal accesible, sobre el elemento `<dialog>` nativo.
 *
 * - El resto de la página queda inerte mientras está abierto.
 * - Escape lo cierra.
 * - El foco queda atrapado adentro (Tab y Shift+Tab dan la vuelta) y, al
 *   cerrarse, vuelve al elemento que lo abrió.
 * - En un teléfono ocupa toda la pantalla y el botón "Cerrar" queda abajo, al
 *   alcance del pulgar; desde `md` es un cuadro centrado.
 *
 * Se monta solo mientras está abierto: `{abierto && <Modal …>}`.
 */
export function Modal({ title, onClose, wide = false, className, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const unmounting = useRef(false);
  const titleId = useId();

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
      className={className ? `${styles.dialog} ${className}` : styles.dialog}
      data-wide={wide}
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
    >
      {/* El cuadro es un Panel de diálogo: el tema le da su marco. El <dialog> solo lo ubica. */}
      <Panel variant="dialog" className={styles.panel}>
        <header className={styles.header}>
          <h2 className={styles.title} id={titleId}>
            {title}
          </h2>
          <Button variant="icon" tone="b" aria-label={es.shell.close} onClick={onClose}>
            <span aria-hidden="true">✕</span>
          </Button>
        </header>
        <div className={styles.body}>{children}</div>
        <footer className={styles.footer}>
          <Button className={styles.close} onClick={onClose}>
            {es.shell.close}
          </Button>
        </footer>
      </Panel>
    </dialog>
  );
}
