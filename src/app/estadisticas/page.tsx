import type { Metadata } from 'next';
import { es } from '@/i18n/es';
import { loadPlayableFranchises } from '../playable';
import { GlobalStats } from './GlobalStats';

export const metadata: Metadata = { title: es.globalStats.title, robots: { index: false } };

/** Pestaña Estadísticas: la racha y los totales de todo el sitio. Se leen del almacenamiento del navegador. */
export default async function StatsPage() {
  const franchises = await loadPlayableFranchises();
  return <GlobalStats franchises={franchises.map(({ slug, name, modes }) => ({ slug, name, modes: modes.map((mode) => mode.slug) }))} />;
}
