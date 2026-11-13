import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CreateRoom } from '@/components/versus/CreateRoom';
import { versusEnabled } from '@/components/versus/enabled';
import { VersusFrame } from '@/components/versus/VersusFrame';
import { es } from '@/i18n/es';

export const metadata: Metadata = { title: es.versus.create.heading, robots: { index: false } };

/** `/versus`: crear una sala. Sin `NEXT_PUBLIC_VERSUS_URL`, la página no existe. */
export default function VersusPage() {
  if (!versusEnabled()) notFound();
  return (
    <VersusFrame title={es.versus.create.heading} lead={es.versus.create.lead}>
      <CreateRoom />
    </VersusFrame>
  );
}
