import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { versusEnabled } from '@/components/versus/enabled';
import { VersusFrame } from '@/components/versus/VersusFrame';
import { VersusHome } from '@/components/versus/VersusHome';
import { es } from '@/i18n/es';

export const metadata: Metadata = { title: es.versus.home.title, robots: { index: false } };

/** `/versus`: la portada (crear una sala o unirse con un código). Sin `NEXT_PUBLIC_VERSUS_URL`, la página no existe. */
export default function VersusPage() {
  if (!versusEnabled()) notFound();
  return (
    <VersusFrame variant="hero" title={es.versus.home.title}>
      <VersusHome />
    </VersusFrame>
  );
}
