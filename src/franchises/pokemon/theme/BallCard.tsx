'use client';

import Link from 'next/link';
import { useSkin } from '@/components/skin/context';
import { PixelIcon } from '@/components/ui/icons';
import type { ModeCardProps } from '../../types';
import { BallImage } from './BallImage';
import styles from './BallCard.module.scss';
import { modeLook } from './modes';

/**
 * Tarjeta de un modo como una bola de imagen (cada modo, la suya: ver `modes.ts`) con el
 * nombre debajo, en un recuadro escalonado. La bola siempre está cerrada. Resuelta hoy: un destello corto
 * alrededor de la bola y una tilde, como un sello, en la esquina de arriba a la izquierda del nombre. Con el hover y el foco se balancea tres pasos. Es un único
 * enlace; su nombre accesible es "Modo: estado" (`label`).
 */
export function BallCard({ slug, name, href, state, label }: ModeCardProps) {
  const { leaveTo } = useSkin();
  const { ball } = modeLook(slug);
  const solved = state === 'solved';

  return (
    <Link className={styles.card} href={href} aria-label={label} data-state={state} data-card="ball" onClick={(event) => leaveTo(event, href)}>
      <span className={styles.ball} aria-hidden="true">
        <BallImage ball={ball} />
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
