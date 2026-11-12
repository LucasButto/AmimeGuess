'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSkin } from '@/components/skin/context';
import { PixelIcon } from '@/components/ui/icons';
import type { ModeCardProps } from '../../types';
import { BallImage } from './BallImage';
import { BallOpen, hasOpenFrames } from './BallOpen';
import styles from './BallCard.module.scss';
import { modeLook } from './modes';

/**
 * Tarjeta de un modo como una bola de imagen (cada modo, la suya: ver `modes.ts`) con el
 * nombre debajo, en un recuadro escalonado. La bola está cerrada; al elegir el modo se abre cuadro a cuadro (`BallOpen`) mientras se cierran las barras de la salida. La Lujo
 * y la Ocaso, que no tienen tira de cuadros, quedan cerradas. Resuelta hoy: un destello corto
 * alrededor de la bola y una tilde, como un sello, en la esquina de arriba a la izquierda del nombre. Con el hover y el foco se balancea tres pasos. Es un único
 * enlace; su nombre accesible es "Modo: estado" (`label`).
 */
const OPEN_RESET_MS = 5000;

export function BallCard({ slug, name, href, state, label }: ModeCardProps) {
  const { leaveTo } = useSkin();
  const { ball } = modeLook(slug);
  const solved = state === 'solved';
  // Abierta desde el clic. Se cierra sola a los 5 s (para entonces la salida ya tapó la pantalla o se retiró), por si la
  // página vuelve a mostrarse sin montarse de nuevo.
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (!opened) return;
    const timer = setTimeout(() => setOpened(false), OPEN_RESET_MS);
    return () => clearTimeout(timer);
  }, [opened]);

  return (
    <Link className={styles.card} href={href} aria-label={label} data-state={state} data-card="ball" data-opened={opened}
      onClick={(event) => {
        leaveTo(event, href);
        // Solo si la salida animada tomó el clic (si no, se navega enseguida o se abre otra pestaña).
        if (event.defaultPrevented) setOpened(true);
      }}>
      <span className={styles.ball} aria-hidden="true">
        {hasOpenFrames(ball) ? <BallOpen ball={ball} className={styles.open} /> : <BallImage ball={ball} />}
        {solved && <span className={styles.sparkle} />}
      </span>
      <span className={styles.name}>
        {solved && (
          <span className={styles.check} aria-hidden="true">
            <span className={styles.checkFill}>
              <PixelIcon name="check" />
            </span>
          </span>
        )}
        {name}
      </span>
    </Link>
  );
}
