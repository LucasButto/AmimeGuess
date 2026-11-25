import { es } from '@/i18n/es';
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

/** Las 17 bocanadas de la nube (el centro y dos anillos de ocho); sus lugares están en Ninja.module.scss. */
const PUFFS = Array.from({ length: 17 }, (_, index) => index);

function SmokeBomb({ phase }: { phase: 'in' | 'out' }) {
  return (
    <span className={styles.transition} data-phase={phase} aria-hidden="true">
      <span className={styles.flash} />
      {PUFFS.map((index) => <i key={index} className={styles.puff} />)}
      <span className={styles.center}>
        <img className={styles.bomb} src="/icons/naruto/bomba-humo.webp" alt="" width={217} height={217} draggable={false} />
        <span className={styles.word}>{es.transitions.smoke}</span>
      </span>
    </span>
  );
}

/**
 * Slot `PageTransition`: la segunda mitad de la bomba de humo. La pantalla nueva arranca tapada por la nube y la abre desde el
 * medio hacia afuera mientras se desvanece (menos de 1 s). Es una animación de
 * entrada, encima de todo y sin recibir toques. Con movimiento reducido no aparece.
 */
export function SmokeIn() {
  return <SmokeBomb phase="in" />;
}

/**
 * Slot `PageExit`: la primera mitad. Al salir de una pantalla, un destello y la nube que estalla desde el medio hasta taparla,
 * con la bomba de humo (el ícono de Borroso) y "¡Puf!" en el centro (`pageExitMs`); recién ahí se navega y la pantalla nueva (`SmokeIn`) la abre. Tapa los toques
 * mientras dura, para que un segundo clic no navegue dos veces. Con movimiento reducido no aparece.
 */
export function SmokeOut() {
  return <SmokeBomb phase="out" />;
}
