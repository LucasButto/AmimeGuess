'use client';

import { useState } from 'react';
import { es } from '@/i18n/es';
import type { AttemptsMeterProps } from '../../types';
import styles from './Extras.module.scss';

/** Cuántos intentos cargan del todo la barra de ki. */
const KI_STEPS = 10;

/**
 * Las semillas del ermitaño de los intentos de la línea de tiempo: tantas como intentos hay, todas enteras al empezar. Cada
 * intento fallido consume una (de derecha a izquierda): la semilla se agita y se achica hasta desaparecer, y deja su
 * silueta gris, el lugar de la vida que se perdió. Las que ya estaban consumidas al llegar (una partida a medias) no se
 * animan: están directamente como silueta. Solo presentación: el texto "Intento N de M" sigue ahí para los lectores de
 * pantalla.
 */
function SenzuBeans({ failed, total }: { failed: number; total: number }) {
  // Los fallos que ya había al montarse (o al volver a empezar, si bajan): esas semillas no se animan.
  const [before, setBefore] = useState(failed);
  if (failed < before) setBefore(failed);
  return (
    <span className={styles.beans} aria-hidden="true">
      <span className={styles.beansLabel}>{es.dragonBallSkin.attempts}</span>
      {Array.from({ length: total }, (_, index) => {
        const spent = index >= total - failed;
        return (
          <span key={index} className={styles.bean} data-spent={spent}>
            {/* La silueta de abajo: la que queda cuando la semilla se consume. */}
            <img className={styles.ghost} src="/theme/dragon-ball/semilla.webp" alt="" width={160} height={157} />
            <img
              className={styles.seed}
              data-spent={spent}
              data-fresh={spent && index < total - before}
              src="/theme/dragon-ball/semilla.webp"
              alt=""
              width={160}
              height={157}
            />
          </span>
        );
      })}
    </span>
  );
}

/**
 * Slot `AttemptsMeter`: una barra de ki que se carga con cada intento (azul, amarilla y naranja a medida que sube); en la
 * línea de tiempo, que pasa cuántos intentos hay en total, las semillas del ermitaño. Solo presentación: el número de
 * intentos ya está escrito al lado.
 */
export function KiMeter({ failed, won, total }: AttemptsMeterProps) {
  if (total !== undefined) return <SenzuBeans failed={Math.min(failed, total)} total={total} />;
  const charge = Math.min(1, (failed + (won ? 1 : 0)) / KI_STEPS);
  const level = charge > 0.6 ? 'high' : charge > 0.3 ? 'mid' : 'low';
  return (
    <span className={styles.ki} aria-hidden="true">
      <span className={styles.kiLabel}>{es.dragonBallSkin.ki}</span>
      <span className={styles.kiTrack} data-level={level}>
        {/* Proporción calculada de los intentos: el único estilo en línea. */}
        <span className={styles.kiFill} style={{ transform: `scaleX(${charge})` }} />
      </span>
    </span>
  );
}
