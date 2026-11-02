import type { Metadata } from 'next';
import { ButtonLink } from '@/components/ui/Button';
import { StatusMessage } from '@/components/StatusMessage';
import { es } from '@/i18n/es';
import styles from '../status-page.module.scss';
import { RetryButton } from './RetryButton';

export const metadata: Metadata = { title: es.offline.title, robots: { index: false } };

/**
 * La página que el service worker muestra cuando no hay conexión y la que se pidió no se había visitado antes
 * (ver `public/sw.js`). Es estática y se guarda al instalar el service worker.
 */
export default function OfflinePage() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{es.offline.heading}</h1>
      <StatusMessage kind="empty" title={es.offline.title} action={<RetryButton />}>
        {es.offline.text}
      </StatusMessage>
      <ButtonLink variant="secondary" href="/">
        {es.offline.home}
      </ButtonLink>
    </main>
  );
}
