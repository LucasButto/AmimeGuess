import Link from 'next/link';
import type { ReactNode } from 'react';
import { es } from '@/i18n/es';
import { SiteFooter } from '../SiteFooter';
import styles from './TabPage.module.scss';
import { TabBar, type TabId } from './TabBar';

interface TabPageProps {
  tab: TabId;
  title: string;
  /** Una línea debajo del título (por ejemplo, el resumen de hoy). */
  lead?: ReactNode;
  children: ReactNode;
}

/**
 * El marco de las pestañas Retos, Estadísticas y Más: título, contenido y la barra de pestañas de abajo. Por debajo de `lg`
 * es la pantalla de una app; desde ahí es una página común con su pie y un enlace para volver al inicio.
 */
export function TabPage({ tab, title, lead, children }: TabPageProps) {
  return (
    <>
      <main className={styles.page}>
        <header className={styles.header}>
          <Link className={styles.home} href="/">{es.nav.home}</Link>
          <h1 className={styles.title}>{title}</h1>
          {lead !== undefined && <p className={styles.lead}>{lead}</p>}
        </header>
        {children}
      </main>
      <div className={styles.footer}>
        <SiteFooter />
      </div>
      <TabBar current={tab} />
    </>
  );
}
