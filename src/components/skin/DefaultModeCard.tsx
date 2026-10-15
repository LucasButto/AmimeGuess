'use client';

import Link from 'next/link';
import type { ModeCardProps } from '@/franchises/types';
import { es } from '@/i18n/es';
import { useSkin } from './context';
import styles from './DefaultModeCard.module.scss';

/**
 * Tarjeta de modo por defecto (slot `ModeCard`): nombre y estado de hoy, con el modo principal destacado.
 * Es la de la sesión 14; la usan las franquicias cuya piel no dibuja la suya.
 */
export function DefaultModeCard({ name, href, index, state }: ModeCardProps) {
  const isMain = index === 0;
  const { leaveTo } = useSkin();
  return (
    <Link className={styles.card} href={href} data-main={isMain} data-state={state} onClick={(event) => leaveTo(event, href)}>
      {isMain && <span className={styles.badge}>{es.franchise.mainMode}</span>}
      <span className={styles.name}>{name}</span>
      {/* El estado se dice con texto y con un ícono, además del color del borde. */}
      <span className={styles.status}>
        {state !== 'unknown' && (
          <>
            <span aria-hidden="true" className={styles.icon}>
              {state === 'solved' ? '✓' : '○'}
            </span>{' '}
            {state === 'solved' ? es.franchise.solved : es.franchise.pending}
          </>
        )}
      </span>
    </Link>
  );
}
