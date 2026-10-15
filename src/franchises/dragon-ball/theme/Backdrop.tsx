'use client';

import { useEffect, useState } from 'react';
import styles from './Backdrop.module.scss';
import { timeOfDay, type TimeOfDay } from './time-of-day';

/** Cada cuánto se vuelve a mirar la hora, por si la página queda abierta al cambiar de franja. */
const RECHECK_MS = 5 * 60 * 1000;

/**
 * Fondo de Dragon Ball (slot `Backdrop`): un paisaje de mesetas de roca y pasto, con tres versiones (día, tarde con el
 * sol bajo y noche con luna y estrellas) que son tres archivos estáticos de public/theme/dragon-ball/. Se elige por la
 * hora local; es solo decoración: el reto nunca depende de la hora local. Antes de montar (y en el servidor) se ve el de
 * día. Fijo detrás del contenido, sin recibir toques y sin ninguna animación.
 */
export function DragonBallBackdrop() {
  const [time, setTime] = useState<TimeOfDay>('day');

  useEffect(() => {
    const update = () => setTime(timeOfDay(new Date().getHours()));
    update();
    const timer = setInterval(update, RECHECK_MS);
    return () => clearInterval(timer);
  }, []);

  return <div className={styles.backdrop} data-time={time} data-backdrop="" aria-hidden="true" />;
}
