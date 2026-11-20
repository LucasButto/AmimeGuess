'use client';

import { useEffect, useState } from 'react';
import styles from './Backdrop.module.scss';
import { markSky } from '../../sky-boot';
import { timeOfDay, type TimeOfDay } from './time-of-day';

/** Cada cuánto se vuelve a mirar la hora, por si la página queda abierta al cambiar de franja. */
const RECHECK_MS = 5 * 60 * 1000;

/**
 * Fondo de Dragon Ball (slot `Backdrop`): un paisaje de mesetas de roca y pasto, con tres versiones (día, tarde con el
 * sol bajo y noche con luna y estrellas) que son tres archivos estáticos de public/theme/dragon-ball/. Se elige por la
 * hora local; es solo decoración: el reto nunca depende de la hora local. El cielo lo elige el atributo que el script del <head> pone en <html> antes de
 * pintar (ver sky-boot.ts): no se ve un instante el de día. Fijo detrás del contenido, sin recibir toques y sin ninguna animación.
 */
export function DragonBallBackdrop() {
  const [time, setTime] = useState<TimeOfDay>('day');

  useEffect(() => {
    const update = () => {
      const next = timeOfDay(new Date().getHours());
      setTime(next);
      // El cielo se pinta con el atributo de <html> (lo puso el script del <head>): se actualiza si cambió la franja.
      markSky('dragon-ball', next);
    };
    update();
    const timer = setInterval(update, RECHECK_MS);
    return () => clearInterval(timer);
  }, []);

  return <div className={styles.backdrop} data-time={time} data-backdrop="" aria-hidden="true" />;
}
