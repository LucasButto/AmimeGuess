'use client';

import { useState, type ReactNode } from 'react';
import styles from './PhoneFold.module.scss';
import { useIsPhone } from './useIsPhone';

/**
 * Una sección que en el teléfono se pliega (arranca cerrada) y desde `lg` se ve abierta, como siempre. Si la persona la abre
 * o la cierra, se respeta lo que eligió. Es un `<details>` común: el título es lo que se toca y el contenido es lo que se oculta.
 */
export function PhoneFold({ title, children }: { title: ReactNode; children: ReactNode }) {
  const phone = useIsPhone();
  const [chosen, setChosen] = useState<boolean | null>(null);
  const open = chosen ?? !phone;
  return (
    <details className={styles.fold} open={open} onToggle={(event) => { if (event.currentTarget.open !== open) setChosen(event.currentTarget.open); }}>
      <summary className={styles.summary}>{title}</summary>
      <div className={styles.body}>{children}</div>
    </details>
  );
}
