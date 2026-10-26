import type { BackNavIconProps } from '../../types';
import styles from './Ninja.module.scss';

/** Un kunai de costado, con la punta hacia la izquierda y el aro al final del mango. Dibujo propio. */
function Kunai({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 24" aria-hidden="true" focusable="false">
      {/* La hoja: un rombo alargado con la punta a la izquierda. */}
      <path className={styles.blade} d="M2 12 L 22 4 L 30 12 L 22 20 Z" />
      <path className={styles.edge} d="M2 12 L 30 12" />
      {/* El mango envuelto en tela, con tres vueltas. */}
      <rect className={styles.grip} x="30" y="9" width="20" height="6" rx="1" />
      <path className={styles.wrap} d="M35 9 L 35 15 M 40 9 L 40 15 M 45 9 L 45 15" />
      {/* El aro del final. */}
      <circle className={styles.ring} cx="56" cy="12" r="5" />
    </svg>
  );
}

/**
 * Un kunai clavado en diagonal: la hoja entra en el tronco hacia abajo a la derecha (se ve solo la mitad, con la grieta
 * donde se hundió) y el mango envuelto con su aro asoma hacia arriba a la izquierda. Dibujo propio.
 */
function StuckKunai() {
  return (
    <svg className={styles.stuckKunai} viewBox="0 0 30 30" aria-hidden="true" focusable="false">
      {/* La grieta en la corteza, donde entró la hoja. */}
      <path className={styles.crack} d="M18 21 L 24 25 M 19 24 L 22 22" />
      {/* La hoja: la mitad que queda afuera, con el filo brillante. */}
      <path className={styles.blade} d="M14 12 L 21 15 L 22 22 L 15 21 Z" />
      <path className={styles.shine} d="M15.5 14 L 20.5 20.5" />
      {/* El mango, con tres vueltas de tela, y el aro. */}
      <path className={styles.handle} d="M5 3 L 15 13" />
      <path className={styles.wraps} d="M7.5 7.5 L 9.5 5.5 M 10 10 L 12 8 M 12.5 12.5 L 14.5 10.5" />
      <circle className={styles.ring} cx="4" cy="4" r="2.75" />
    </svg>
  );
}

/** Un shuriken de cuatro puntas clavado en el tronco, un poco torcido, con su sombra en la corteza. Dibujo propio. */
function StuckShuriken() {
  return (
    <svg className={styles.stuckShuriken} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path className={styles.starShadow} d="M13 2 L 15 11 L 23 13 L 15 15 L 13 23 L 11 15 L 3 13 L 11 11 Z" />
      <path className={styles.starDark} d="M12 1 L 14 10 L 22 12 L 14 14 L 12 22 L 10 14 L 2 12 L 10 10 Z" />
      <circle className={styles.starHole} cx="12" cy="12" r="1.75" />
    </svg>
  );
}

/**
 * Dibujo de los botones de volver de Naruto (slot `BackNav`; la caja es común a todos los temas, ver `BackNav`):
 * - La franquicia: un kunai. Con el hover y el foco gira un poco; al hacer clic sale disparado hacia la izquierda y recién
 *   ahí `BackNav` navega (250 ms, ver `backNavExitMs`).
 * - Inicio: el tronco de la técnica de sustitución, con un kunai clavado a la izquierda y un shuriken a la derecha, y
 *   "Inicio" escrito en el medio (el tronco es el botón entero, ver `a[data-kind='home']` en theme.module.scss). Con el
 *   hover y el foco el tronco se tambalea y las letras se ponen naranjas. Al hacer clic, una nube de humo ("¡puf!") lo
 *   tapa antes de navegar.
 * Con movimiento reducido no hay animación. Los colores salen de la paleta.
 */
export function NinjaBackNav({ kind, leaving }: BackNavIconProps) {
  if (kind === 'franchise') {
    return (
      <span className={styles.kunaiBox} data-leaving={leaving}>
        <Kunai className={styles.kunai} />
      </span>
    );
  }
  return (
    <span className={styles.kunaiBox} data-kind="log" data-leaving={leaving}>
      <StuckKunai />
      <StuckShuriken />
      <span className={styles.smoke}>
        <i />
        <i />
        <i />
      </span>
    </span>
  );
}

/** Slot `Loader`: un shuriken de cuatro puntas que gira (quieto con movimiento reducido). */
export function ShurikenLoader() {
  return (
    <span className={styles.loader} aria-hidden="true">
      <svg className={styles.shuriken} viewBox="0 0 40 40" focusable="false">
        <path
          className={styles.star}
          d="M20 1 L 24 16 L 39 20 L 24 24 L 20 39 L 16 24 L 1 20 L 16 16 Z"
        />
        <circle className={styles.hole} cx="20" cy="20" r="4" />
      </svg>
    </span>
  );
}

/**
 * Slot `PageTransition`: una nube de humo que tapa la pantalla y se abre en menos de 400 ms, como al aparecer con una
 * técnica. Es una animación de entrada, encima de todo y sin recibir toques. Con movimiento reducido no aparece.
 */
export function SmokeIn() {
  return (
    <span className={styles.transition} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}
