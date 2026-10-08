'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './CopyButton.module.scss';
import { VisuallyHidden } from './VisuallyHidden';

type Status = 'idle' | 'copied' | 'failed';

const FEEDBACK_MS = 2500;

interface CopyButtonProps {
  /** El texto se arma al hacer clic, para que refleje el estado de ese momento. */
  getText: () => string;
  label: string;
  copiedLabel: string;
  failedLabel: string;
  /** `primary` para la acción principal de una pantalla; por defecto, secundaria. */
  variant?: 'primary' | 'secondary';
}

/** Botón que copia un texto al portapapeles y lo confirma, a la vista y para lectores de pantalla. */
export function CopyButton({ getText, label, copiedLabel, failedLabel, variant = 'secondary' }: CopyButtonProps) {
  const [status, setStatus] = useState<Status>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    setStatus((await copyText(getText())) ? 'copied' : 'failed');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus('idle'), FEEDBACK_MS);
  }

  const visible = status === 'copied' ? copiedLabel : status === 'failed' ? failedLabel : label;

  return (
    <>
      <button type="button" className={styles.button} data-variant={variant} onClick={copy}>
        {visible}
      </button>
      <VisuallyHidden role="status">{status === 'idle' ? '' : visible}</VisuallyHidden>
    </>
  );
}

async function copyText(text: string): Promise<boolean> {
  // `navigator.clipboard` solo existe en páginas seguras (https o localhost): al
  // probar desde el teléfono por la red local (http://192.168…) no está.
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permiso denegado: se prueba el plan B.
  }

  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.className = styles.offscreen;
  document.body.appendChild(area);
  area.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
  }
}
