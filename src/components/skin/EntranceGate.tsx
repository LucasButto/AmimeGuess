'use client';

import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { isCovering, previousPath } from '../route-static';
import styles from './EntranceGate.module.scss';

/**
 * Envuelve la animación de entrada del tema (slot `PageTransition`) de una página.
 * - Si se llegó atravesando la estática del televisor (desde el inicio, ver `route-static.ts`), no la dibuja: es un cambio de
 *   canal y la estática ya hace de transición.
 * - Le dice hacia dónde se va con `data-entrance`: `back` si se viene de una página que cuelga de esta (de un modo a la página de
 *   su franquicia), `forward` si no. El tema decide qué hacer con eso (Dragon Ball: la nave cruza al revés).
 * Se decide una sola vez, al montarse la página: mientras se dibuja, `previousPath` todavía es la página anterior.
 */
export function EntranceGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [entrance] = useState(() => {
    if (isCovering()) return null;
    const from = previousPath();
    return from !== null && from !== pathname && from.startsWith(`${pathname}/`) ? 'back' : 'forward';
  });
  if (entrance === null) return null;
  return <div className={styles.root} data-entrance={entrance}>{children}</div>;
}
