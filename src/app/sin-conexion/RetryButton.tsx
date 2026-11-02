'use client';

import { Button } from '@/components/ui/Button';
import { es } from '@/i18n/es';

/** Vuelve a pedir la página: si ya hay conexión, abre la que se había pedido. */
export function RetryButton() {
  return <Button onClick={() => window.location.reload()}>{es.offline.retry}</Button>;
}
