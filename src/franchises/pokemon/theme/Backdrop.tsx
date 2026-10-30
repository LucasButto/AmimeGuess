'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import styles from './Backdrop.module.scss';
import { timeOfDay, type TimeOfDay } from './time-of-day';
import { PokemonWalkers } from './Walkers';

const lowLandscape = () => window.innerWidth > window.innerHeight && window.innerHeight <= 26 * parseFloat(getComputedStyle(document.documentElement).fontSize);
function subscribeViewport(change: () => void) {
  window.addEventListener('resize', change);
  return () => window.removeEventListener('resize', change);
}
const serverLow = () => false;

/** Cada cuánto se vuelve a mirar la hora, por si la página queda abierta al cambiar de franja. */
const RECHECK_MS = 5 * 60 * 1000;

/**
 * Fondo de Pokémon (slot `Backdrop`): cielo en bandas con tramado, dos capas de nubes pixel que avanzan muy
 * lento y una franja de pasto con mechones que se mecen apenas. Fijo detrás del contenido y decorativo. Las
 * nubes y el pasto son SVG estáticos (art.ts), junto con árboles, agua y orilla (landscape-art.ts); el cielo y el suelo, CSS con las
 * variables de la paleta. Tres capas ambientales CSS, solo con `transform`; quietas con movimiento
 * reducido. Todas las páginas de la piel llevan actores PMD, con reloj visible y carga diferida.
 *
 * El cielo cambia según la hora local (amanecer, día, atardecer y noche con estrellas). Es solo decoración:
 * el reto nunca depende de la hora local. Antes de montar (y en el servidor) se ve el de día.
 */
export function PokemonBackdrop() {
  const [time, setTime] = useState<TimeOfDay>('day');
  const low = useSyncExternalStore(subscribeViewport, lowLandscape, serverLow);

  useEffect(() => {
    const update = () => setTime(timeOfDay(new Date().getHours()));
    update();
    const timer = setInterval(update, RECHECK_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={styles.backdrop} data-time={time} data-pmd-scene="true" data-pmd-low={low || undefined} aria-hidden="true">
      <div className={styles.sky}>
        <div className={styles.dither} data-band="high" />
        <div className={styles.dither} data-band="low" />
        <div className={styles.stars} />
      </div>
      <div className={styles.clouds} data-layer="back" />
      <div className={styles.clouds} data-layer="front" />
      <div className={styles.trees} data-pmd-trees="" />
      <div className={styles.farBank} data-pmd-far-bank="" />
      <div className={styles.water} data-pmd-water="" />
      <div className={styles.bank} data-pmd-bank="" />
      <div className={styles.ground} data-pmd-ground="">
        <div className={styles.tufts} data-pmd-grass-patches="true" />
      </div>
      <PokemonWalkers />
    </div>
  );
}
