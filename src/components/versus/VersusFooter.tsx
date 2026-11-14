'use client';

import Link from 'next/link';
import { DismissibleFooter, useFooterDismiss } from '@/components/DismissibleFooter';
import { es } from '@/i18n/es';
import { ArcadeIcon } from './arcade/ArcadeIcon';
import styles from './VersusFooter.module.scss';

function VersusNotice() {
  const onDismiss = useFooterDismiss();
  return (
    <footer className={styles.footer} aria-label={es.footer.label}>
      <div className={styles.box}>
        {onDismiss !== null && (
          <button type="button" className={styles.close} aria-label={es.footer.dismiss} onClick={onDismiss}>
            <ArcadeIcon name="close" size="sm" />
          </button>
        )}
        <p className={styles.notice}>{es.footer.notice}</p>
        <Link className={styles.link} href="/creditos">{es.footer.credits}</Link>
      </div>
    </footer>
  );
}

/**
 * El pie del versus (Retro Battle): el aviso de proyecto de fans y el enlace a Créditos dentro de un recuadro, con una cruz
 * para cerrarlo. Cierra igual que los pies del resto del sitio: se recuerda en este navegador y Créditos sigue en `/creditos`.
 */
export function VersusFooter() {
  return (
    <DismissibleFooter>
      <VersusNotice />
    </DismissibleFooter>
  );
}
