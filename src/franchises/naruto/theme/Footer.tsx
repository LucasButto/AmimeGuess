'use client';

import Link from 'next/link';
import { useFooterDismiss } from '@/components/DismissibleFooter';
import { es } from '@/i18n/es';
import type { ChipMarkProps } from '../../types';
import styles from './Footer.module.scss';

/**
 * Pie de Naruto (slot `Footer`): un pergamino horizontal con un rodillo de madera en cada extremo, con el aviso de
 * proyecto de fans (SPEC 10) y el enlace a Créditos.
 */
export function ScrollFooter() {
  const onDismiss = useFooterDismiss();
  return (
    <footer className={styles.footer} aria-label={es.footer.label}>
      <div className={styles.inner}>
        <span className={styles.roller} aria-hidden="true" />
        <div className={styles.sheet}>
          {/* La cruz para cerrar: un sello rojo estampado en la esquina de arriba a la derecha del papel. */}
          {onDismiss !== null && (
            <button type="button" className={styles.close} aria-label={es.footer.dismiss} onClick={onDismiss}>
              <span aria-hidden="true">✕</span>
            </button>
          )}
          <p className={styles.notice}>{es.footer.notice}</p>
          <Link className={styles.link} href="/creditos">
            {es.footer.credits}
          </Link>
        </div>
        <span className={styles.roller} aria-hidden="true" />
      </div>
    </footer>
  );
}

/**
 * Slot `ChipMark` de Naruto: con la serie activa, una placa de metal con la hoja de Konoha grabada; apagada, la misma
 * placa gris con una raya recta por el medio, como una bandana tachada. Cambia el dibujo (grabada o tachada), no solo
 * el color.
 */
export function MetalPlate({ on }: ChipMarkProps) {
  return (
    <svg className={styles.plate} data-on={on} viewBox="0 0 28 20" aria-hidden="true" focusable="false">
      <rect className={styles.metal} x="1" y="1" width="26" height="18" rx="3" />
      {/* La hoja de Konoha grabada (en una grilla de 48 × 48, centrada en la placa). */}
      <svg x="8" y="3" width="12" height="14" viewBox="0 0 48 48" preserveAspectRatio="xMidYMid meet">
        <path className={styles.leaf} d="M37 14.2 A 17 17 0 1 0 43 28 A 11 11 0 0 0 21 28 A 5.5 5.5 0 0 0 32 28 A 2.4 2.4 0 0 0 27.2 28 M11.5 18 Q 5 30 3 44 Q 12 46 22 44.6 M37 14.2 L 45 6.2" />
      </svg>
      {/* Apagada: una raya recta de lado a lado por el medio, como la de una bandana tachada. */}
      {!on && <path className={styles.cross} d="M2 10 L26 10" />}
    </svg>
  );
}
