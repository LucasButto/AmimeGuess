'use client';

import { useEffect, useState } from 'react';
import styles from './Backdrop.module.scss';
import { timeOfDay, type TimeOfDay } from './time-of-day';

/** Cada cuánto se vuelve a mirar la hora, por si la página queda abierta al cambiar de franja. */
const RECHECK_MS = 5 * 60 * 1000;

/**
 * Fondo de Pokémon (slot `Backdrop`): cielo en bandas con tramado, dos capas de nubes pixel que avanzan muy
 * lento y una franja de pasto con mechones que se mecen apenas. Fijo detrás del contenido y decorativo. Las
 * nubes y el pasto son SVG estáticos (public/theme/pokemon/, ver art.ts); el cielo y el suelo, CSS con las
 * variables de la paleta. Tres capas animadas como máximo, solo con `transform`; quietas con movimiento
 * reducido.
 *
 * El cielo cambia según la hora local (amanecer, día, atardecer y noche con estrellas). Es solo decoración:
 * el reto nunca depende de la hora local. Antes de montar (y en el servidor) se ve el de día.
 */
export function PokemonBackdrop() {
  const [time, setTime] = useState<TimeOfDay>('day');

  useEffect(() => {
    const update = () => setTime(timeOfDay(new Date().getHours()));
    update();
    const timer = setInterval(update, RECHECK_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={styles.backdrop} data-time={time} aria-hidden="true">
      <div className={styles.sky}>
        <div className={styles.dither} data-band="high" />
        <div className={styles.dither} data-band="low" />
        <div className={styles.stars} />
      </div>
      <div className={styles.clouds} data-layer="back" />
      <div className={styles.clouds} data-layer="front" />
      <div className={styles.ground}>
        <div className={styles.tufts} />
      </div>
    </div>
  );
}
