'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import styles from './Backdrop.module.scss';
import { timeOfDay, type TimeOfDay } from './time-of-day';

/** Cada cuánto se vuelve a mirar la hora, por si la página queda abierta al cambiar de franja. */
const RECHECK_MS = 5 * 60 * 1000;

/**
 * Pétalos que caen, en tres grupos de dos (el fondo anima como mucho 3 capas, ver docs/DESIGN.md): cada grupo cae entero,
 * con su duración y su retraso, y lleva dos pétalos a distinta altura y en distinto lugar (en % del ancho y en vh), cada
 * uno con su inclinación fija.
 */
const LEAF_GROUPS = [
  { duration: 47, delay: -8, leaves: [{ x: 8, y: 0, turn: 20 }, { x: 58, y: -60, turn: -35 }] },
  { duration: 58, delay: -33, leaves: [{ x: 22, y: -25, turn: 65 }, { x: 74, y: -85, turn: -10 }] },
  { duration: 52, delay: -16, leaves: [{ x: 41, y: -45, turn: -55 }, { x: 90, y: -10, turn: 40 }] },
];

/**
 * Fondo de Naruto (slot `Backdrop`): una ilustración de la aldea vista desde lo alto, con tres versiones (día, tarde con
 * el sol bajo y noche con luna) que son tres archivos estáticos de public/theme/naruto/. Se elige por la hora local; es
 * solo decoración: el reto nunca depende de la hora local. Antes de montar (y en el servidor) se ve el de día. Encima,
 * unas pocas hojas caen muy lento (quietas con movimiento reducido). Fijo detrás del contenido y sin recibir toques.
 */
export function NarutoBackdrop() {
  const [time, setTime] = useState<TimeOfDay>('day');

  useEffect(() => {
    const update = () => setTime(timeOfDay(new Date().getHours()));
    update();
    const timer = setInterval(update, RECHECK_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={styles.backdrop} data-time={time} data-backdrop="" aria-hidden="true">
      <div className={styles.leaves}>
        {LEAF_GROUPS.map((group) => (
          <span
            key={group.delay}
            className={styles.leafGroup}
            style={{ '--fall': `${group.duration}s`, '--delay': `${group.delay}s` } as CSSProperties}
          >
            {group.leaves.map((leaf) => (
              <span
                key={leaf.x}
                className={styles.leaf}
                style={{ '--x': `${leaf.x}%`, '--y': `${leaf.y}vh`, '--turn': `${leaf.turn}deg` } as CSSProperties}
              />
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}
