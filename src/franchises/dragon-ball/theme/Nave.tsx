import styles from './Nave.module.scss';

function Flight({ phase }: { phase: 'in' | 'out' }) {
  return (
    <span className={styles.root} data-phase={phase} aria-hidden="true">
      <span className={styles.glow} />
      <span className={styles.axis}>
        <span className={styles.run}>
          <span className={styles.ship}>
            <img className={styles.pod} src="/icons/dragon-ball/nave-vuelo-b.webp" alt="" width={1200} height={595} draggable={false} />
          </span>
        </span>
      </span>
    </span>
  );
}

/**
 * Slot `PageTransition`: la segunda mitad de la transición. Entra a un modo con la pantalla tapada por un resplandor
 * dorado mientras la nave Saiyajin sigue cruzando de izquierda a derecha, fija, con su estela de energía y el cristal hacia adelante; al irse por la derecha, el resplandor se
 * apaga y queda la página nueva (900 ms). No intercepta la navegación: es una animación de entrada, encima de todo y sin recibir
 * toques. Con movimiento reducido no aparece.
 */
export function NaveIn() {
  return <Flight phase="in" />;
}

/**
 * Slot `PageExit`: la primera mitad. Al salir de una pantalla, el resplandor dorado la tapa mientras la nave Saiyajin
 * (`public/icons/dragon-ball/nave-vuelo-b.webp`, con su estela) entra por la izquierda y llega al medio (900 ms); recién ahí se navega, y la
 * pantalla nueva (`NaveIn`) sigue el recorrido desde el mismo punto. Tapa los toques mientras dura, para que un segundo clic
 * no navegue dos veces.
 */
export function NaveOut() {
  return <Flight phase="out" />;
}
