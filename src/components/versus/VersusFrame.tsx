import Link from 'next/link';
import type { ReactNode } from 'react';
import { es } from '@/i18n/es';
import { ArcadeBackground } from './arcade/ArcadeBackground';
import { ArcadeIcon } from './arcade/ArcadeIcon';
import { VersusLogo } from './arcade/VersusLogo';
import { VersusFooter } from './VersusFooter';
import styles from './VersusFrame.module.scss';

interface VersusFrameProps {
  title: string;
  /** Una línea debajo del título. */
  lead?: ReactNode;
  /** `hero`: la portada (logo grande y lema). `page`: la cabecera de las demás pantallas. */
  variant?: 'hero' | 'page';
  /** `create`: en pantallas anchas, el contenido sube a la derecha del título (la caja del apodo). */
  layout?: 'create';
  /** El enlace de arriba a la izquierda. Por defecto lleva al inicio del sitio. */
  back?: { href: string; label: string };
  children: ReactNode;
}

/**
 * El marco de las pantallas del versus (VersusLayout): la arena nocturna de fondo, el logo, el título de la pantalla y un enlace
 * para volver al inicio. No son de ninguna franquicia: llevan la identidad Retro Battle. Sin barra de pestañas (es un recorrido,
 * como la pantalla de juego).
 */
export function VersusFrame({ title, lead, variant = 'page', layout, back = { href: '/', label: es.nav.home }, children }: VersusFrameProps) {
  return (
    <div className={styles.stage} data-versus-stage>
      <ArcadeBackground />
      <main className={styles.page} data-versus-screen data-variant={variant} data-layout={layout}>
        <header className={styles.header}>
          <Link className={styles.back} href={back.href}>
            <ArcadeIcon name="arrow-left" size="sm" /> {back.label}
          </Link>
          <div className={styles.brand}>
            <VersusLogo variant={variant} />
            {variant === 'page' && <h1 className={styles.title}>{title}</h1>}
            {variant === 'hero' && <h1 className={styles.srOnly}>{title}</h1>}
          </div>
          {lead !== undefined && <p className={styles.lead}>{lead}</p>}
        </header>
        {children}
      </main>
      <VersusFooter />
    </div>
  );
}
