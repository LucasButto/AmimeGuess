import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { versusEnabled } from '@/components/versus/enabled';
import { RoomScreen } from '@/components/versus/RoomScreen';
import { VersusFrame } from '@/components/versus/VersusFrame';
import { es } from '@/i18n/es';

export const metadata: Metadata = { title: es.versus.room.title, robots: { index: false } };

/**
 * `/versus/sala?c=CÓDIGO`: la sala de espera. La página es estática: el código llega por `?c=` y se lee en el cliente
 * (`useSearchParams` dentro de `Suspense`). Sin `NEXT_PUBLIC_VERSUS_URL`, no existe.
 */
export default function RoomPage() {
  if (!versusEnabled()) notFound();
  return (
    <VersusFrame title={es.versus.room.title}>
      <Suspense fallback={<p role="status">{es.versus.room.connecting}</p>}>
        <RoomScreen />
      </Suspense>
    </VersusFrame>
  );
}
