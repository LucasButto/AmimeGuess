import type { BackNavIconProps } from '../../types';
import styles from './Ninja.module.scss';

/**
 * Dibujo de los botones de volver de Naruto (slot `BackNav`; la caja es común a todos los temas, ver `BackNav`):
 * - La franquicia: un pergamino abierto (`public/icons/naruto/pergamino-abierto.webp`). Con el hover y el
 *   foco gira un poco; al hacer clic sale disparado hacia la izquierda y recién ahí `BackNav` navega (250 ms, ver
 *   `backNavExitMs`).
 * - Inicio: el tronco de la técnica de sustitución (`public/theme/naruto/tronco-boton.webp`, el ícono del tronco acostado y
 *   alargado) con un shuriken y un kunai clavados (`public/icons/naruto/`) y "Inicio" escrito encima (el tronco es el botón entero, ver `a[data-kind='home']` en theme.module.scss). Con
 *   el hover y el foco el tronco se tambalea y las letras se ponen naranjas. Al hacer clic, una nube de humo ("¡puf!") lo
 *   tapa antes de navegar.
 * Con movimiento reducido no hay animación.
 */
export function NinjaBackNav({ kind, leaving }: BackNavIconProps) {
  if (kind === 'franchise') {
    return (
      <span className={styles.kunaiBox} data-leaving={leaving}>
        <img className={styles.scroll} src="/icons/naruto/pergamino-abierto.webp" alt="" width={210} height={210} draggable={false} />
      </span>
    );
  }
  return (
    <span className={styles.kunaiBox} data-kind="log" data-leaving={leaving}>
      <img className={styles.log} src="/theme/naruto/tronco-boton.webp" alt="" width={328} height={126} draggable={false} />
      <img className={styles.stuckShuriken} src="/icons/naruto/shuriken.webp" alt="" width={198} height={198} draggable={false} />
      <img className={styles.stuckKunai} src="/icons/naruto/kunai.webp" alt="" width={210} height={210} draggable={false} />
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
      <img className={styles.shuriken} src="/icons/naruto/shuriken.webp" alt="" width={198} height={198} draggable={false} />
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

/**
 * Slot `PageExit`: la primera mitad de la bomba de humo. Al salir de una pantalla, las cinco bocanadas llegan desde afuera y
 * la tapan en 280 ms; recién ahí se navega y la pantalla nueva (`SmokeIn`) arranca con el humo ya tapándola y lo abre. Sin esto
 * la página vieja desaparecía de golpe, con un pantallazo vacío en el medio. Tapa los toques mientras dura, para que un segundo
 * clic no navegue dos veces. Con movimiento reducido no aparece.
 */
export function SmokeOut() {
  return (
    <span className={`${styles.transition} ${styles.exit}`} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}
