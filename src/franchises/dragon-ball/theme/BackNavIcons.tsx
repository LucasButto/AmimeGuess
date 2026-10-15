import type { BackNavIconProps } from '../../types';
import styles from './BackNavIcons.module.scss';

/**
 * Dibujo de los botones de volver de Dragon Ball (slot `BackNav`; la caja es común a todos los temas, ver `BackNav`):
 * - Inicio: la nube voladora (public/theme/dragon-ball/nube-voladora.webp) es el botón entero y el texto va adentro. Con
 *   el hover y el foco flota un poco; al hacer clic se disipa en el lugar (sube un poco, se agranda y se desvanece) y recién
 *   ahí `BackNav` navega (250 ms, ver `backNavExitMs`). Eso lo anima `theme.module.scss` sobre el enlace entero, así el texto va
 *   con la nube. No se mueve de lado: dentro de un juego, el radar está a su derecha.
 * - La franquicia: el radar del dragón (radar.webp) con el nombre al lado. Un anillo amarillo late sobre una de las
 *   esferas de su pantalla una vez por segundo; con el hover se inclina, y al salir se achica hacia su punto.
 * La imagen va fuera de la caja del enlace (posición absoluta, detrás del texto): el texto y los estilos de la caja los pone
 * `theme.module.scss`. Con movimiento reducido no hay animación.
 */
export function DragonBackNav({ kind, leaving }: BackNavIconProps) {
  return kind === 'home' ? <Nimbus /> : <Radar leaving={leaving} />;
}

function Nimbus() {
  return <img className={styles.nimbus} src="/theme/dragon-ball/nube-voladora.webp" alt="" width={640} height={304} />;
}

function Radar({ leaving }: { leaving: boolean }) {
  return (
    <span className={styles.radar} data-leaving={leaving}>
      <img className={styles.radarImage} src="/theme/dragon-ball/radar.webp" alt="" width={329} height={360} />
      <span className={styles.ping} />
    </span>
  );
}
