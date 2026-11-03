import type { Metadata } from 'next';
import { es } from '@/i18n/es';
import { MoreMenu } from './MoreMenu';

export const metadata: Metadata = { title: es.more.title, robots: { index: false } };

/** Pestaña Más: ajustes, cómo se juega, instalar la app, créditos y aviso legal. */
export default function MorePage() {
  return <MoreMenu />;
}
