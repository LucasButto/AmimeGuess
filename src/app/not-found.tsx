import type { Metadata } from 'next';
import { ButtonLink } from '@/components/ui/Button';
import { SiteFooter } from '@/components/SiteFooter';
import { StatusMessage } from '@/components/StatusMessage';
import { es } from '@/i18n/es';
import styles from './status-page.module.scss';

export const metadata: Metadata = { title: es.notFound.title, robots: { index: false } };

/** 404 propia: la misma para una ruta inexistente y para una franquicia o modo que no existe. */
export default function NotFound() {
  return (
    <>
      <main className={styles.page}>
        <h1 className={styles.title}>404</h1>
        <StatusMessage kind="empty" title={es.notFound.title} action={<ButtonLink href="/">{es.notFound.home}</ButtonLink>}>
          {es.notFound.text}
        </StatusMessage>
      </main>
      <SiteFooter />
    </>
  );
}
