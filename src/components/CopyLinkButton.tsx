'use client';

import { useEffect, useRef, useState } from 'react';
import { es } from '@/i18n/es';
import styles from './CopyLinkButton.module.scss';
import { VisuallyHidden } from './VisuallyHidden';

type Status = 'idle' | 'copied' | 'failed';

const FEEDBACK_MS = 2500;

interface CopyLinkButtonProps {
  /** Clave de filtro actual (`all`, `g1.g2`…): el link siempre la lleva, para que quien lo abra vea el mismo reto. */
  filterKey: string;
}

/** Copia la dirección de la página con el parámetro `s` de los filtros activos. */
export function CopyLinkButton({ filterKey }: CopyLinkButtonProps) {
  const [status, setStatus] = useState<Status>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    const url = new URL(window.location.href);
    url.searchParams.set('s', filterKey);
    setStatus((await copyText(url.toString())) ? 'copied' : 'failed');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus('idle'), FEEDBACK_MS);
  }

  return (
    <>
      <button type="button" className={styles.button} onClick={copy}>
        {status === 'copied' ? es.game.linkCopied : status === 'failed' ? es.game.linkCopyFailed : es.game.copyLink}
      </button>
      <VisuallyHidden role="status">
        {status === 'copied' ? es.game.linkCopied : status === 'failed' ? es.game.linkCopyFailed : ''}
      </VisuallyHidden>
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
