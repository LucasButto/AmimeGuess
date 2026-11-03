import type { CSSProperties } from 'react';
import styles from './Shenlong.module.scss';

/** En cuántas tajadas verticales se corta la imagen del dragón para que ondule (ver `Shenlong.module.scss`). */
const SLICES = 48;

function Flight({ phase }: { phase: 'in' | 'out' }) {
  return (
    <span className={styles.root} data-phase={phase} aria-hidden="true">
      <span className={styles.glow} />
      <span className={styles.axis}>
        <span className={styles.run}>
          <span className={styles.dragon}>
            {Array.from({ length: SLICES }, (_, index) => (
              // `--i` es el lugar de la tajada; `--k`, cuánto se atrasa su onda (más hacia la cola).
              <i key={index} className={styles.slice} style={{ '--i': index, '--k': SLICES - 1 - index } as CSSProperties} />
            ))}
          </span>
        </span>
      </span>
    </span>
  );
}

/**
 * Slot `PageTransition`: la segunda mitad de la transición. Entra a un modo con la pantalla tapada por un resplandor
 * dorado mientras Shenlong sigue cruzando de izquierda a derecha; al irse la cola, el resplandor se apaga y queda la
 * página nueva (900 ms). No intercepta la navegación: es una animación de
 * entrada, encima de todo y sin recibir toques. Con movimiento reducido no aparece.
 */
export function ShenlongIn() {
  return <Flight phase="in" />;
}

/**
 * Slot `PageExit`: la primera mitad. Al salir de una pantalla, el resplandor dorado la tapa mientras Shenlong entra por
 * la izquierda y llega al medio (900 ms); recién ahí se navega, y la pantalla nueva (`ShenlongIn`) sigue el recorrido
 * desde el mismo punto. Tapa los toques mientras dura, para que un segundo clic no navegue dos veces.
 */
export function ShenlongOut() {
  return <Flight phase="out" />;
}
