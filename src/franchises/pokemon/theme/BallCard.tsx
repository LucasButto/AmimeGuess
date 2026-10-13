'use client';

import Link from 'next/link';
import { useSkin } from '@/components/skin/context';
import { PixelIcon } from '@/components/ui/icons';
import { PixelArt } from '@/components/ui/PixelArt';
import type { ModeCardProps } from '../../types';
import { CARD_BALL_BOTTOM, CARD_BALL_BUTTON, CARD_BALL_TOP, MODE_ICONS, ballColors, inlineArt } from './art';
import styles from './BallCard.module.scss';
import { modeLook } from './modes';

/**
 * Tarjeta de un modo como Poké Ball (30 × 30 píxeles de arte) con el ícono del modo en el botón y el
 * nombre debajo, en un recuadro escalonado. Pendiente: cerrada. Resuelta hoy: la mitad de arriba se
 * levanta, con un destello corto y una tilde. Con el hover y el foco se balancea tres pasos. Es un único
 * enlace; su nombre accesible es "Modo: estado" (`label`).
 */
export function BallCard({ slug, name, href, state, label }: ModeCardProps) {
  const { leaveTo } = useSkin();
  const { tone, icon } = modeLook(slug);
  const colors = ballColors(tone);
  const solved = state === 'solved';

  return (
    <Link className={styles.card} href={href} aria-label={label} data-state={state} data-card="ball" onClick={(event) => leaveTo(event, href)}>
      <span className={styles.ball} aria-hidden="true">
        <PixelArt art={inlineArt({ rows: CARD_BALL_TOP, colors })} className={styles.top} />
        <PixelArt art={inlineArt({ rows: CARD_BALL_BOTTOM, colors })} className={styles.bottom} />
        <PixelArt art={inlineArt(CARD_BALL_BUTTON)} className={styles.button} />
        <PixelArt art={inlineArt(MODE_ICONS[icon])} className={styles.icon} />
        {solved && (
          <>
            <span className={styles.sparkle} />
            <span className={styles.check}>
              <PixelIcon name="check" />
            </span>
          </>
        )}
      </span>
      <span className={styles.name}>{name}</span>
    </Link>
  );
}
