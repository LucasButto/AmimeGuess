'use client';

import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { es } from '@/i18n/es';
import styles from './Modal.module.scss';

interface ModalProps {
  title: string;
  /** Se llama al cerrar con Escape, con el botón o tocando fuera del cuadro. Quien lo usa deja de montar el modal. */
  onClose: () => void;
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
export function Modal({ title, onClose, children }: ModalProps) {
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
      className={styles.dialog}
      aria-labelledby={titleId}
      onKeyDown={handleKeyDown}
      onClose={() => {
        if (!unmounting.current) onClose();
      }}
      // Un clic sobre el fondo oscuro llega al propio <dialog>, no a su contenido.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <header className={styles.header}>
        <h2 className={styles.title} id={titleId}>
          {title}
        </h2>
        <button type="button" className={styles.x} aria-label={es.shell.close} onClick={onClose}>
          <span aria-hidden="true">✕</span>
        </button>
      </header>
      <div className={styles.body}>{children}</div>
      <footer className={styles.footer}>
        <button type="button" className={styles.close} onClick={onClose}>
          {es.shell.close}
        </button>
      </footer>
    </dialog>
  );
}
