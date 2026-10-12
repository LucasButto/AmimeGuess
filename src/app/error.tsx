'use client';

import { Button, ButtonLink } from '@/components/Button';
import { StatusMessage } from '@/components/StatusMessage';
import { es } from '@/i18n/es';
import styles from './status-page.module.scss';

/** Cualquier error inesperado al mostrar una página: se puede reintentar sin recargar o volver al inicio. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className={styles.page}>
      <StatusMessage
        kind="error"
        title={es.errorPage.title}
        action={
          <>
            <Button onClick={reset}>{es.errorPage.retry}</Button>
            <ButtonLink variant="secondary" href="/">
              {es.errorPage.home}
            </ButtonLink>
          </>
        }
      >
        {es.errorPage.text}
      </StatusMessage>
    </main>
  );
}
