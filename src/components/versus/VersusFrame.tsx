import Link from 'next/link';
import type { ReactNode } from 'react';
import { es } from '@/i18n/es';
import { SiteFooter } from '../SiteFooter';
import styles from './VersusFrame.module.scss';

interface VersusFrameProps {
  title: string;
  /** Una línea debajo del título. */
  lead?: ReactNode;
  children: ReactNode;
}

/**
 * El marco de las pantallas del versus (crear sala, sala de espera): título, contenido y un enlace para volver al inicio. No
 * son de ninguna franquicia: llevan el aspecto del sitio. Sin barra de pestañas (es un recorrido, como la pantalla de juego).
 */
export function VersusFrame({ title, lead, children }: VersusFrameProps) {
  return (
    <>
      <main className={styles.page} data-versus-screen>
        <header className={styles.header}>
          <Link className={styles.back} href="/">
            <span aria-hidden="true">←</span> {es.nav.home}
          </Link>
          <p className={styles.eyebrow}>{es.versus.create.title}</p>
          <h1 className={styles.title}>{title}</h1>
          {lead !== undefined && <p className={styles.lead}>{lead}</p>}
        </header>
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
