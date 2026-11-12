import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { allFranchises, getFranchise } from '@/franchises';
import { loadFranchiseData } from '@/franchises/data';
import { appShellEnabled } from '@/franchises/visibility';
import { es } from '@/i18n/es';
import { modeStatus } from '../[mode]/playable';
import { VersusDev } from './VersusDev';

// Página de desarrollo del versus (sesión 28, paso 1.6): monta una partida de versus falsa, sin servidor, con el tema de
// la franquicia. Solo existe con `next dev`; en producción es un 404 y no está en el sitemap.

export const metadata: Metadata = { title: es.versus.dev.title, robots: { index: false, follow: false } };

export default async function VersusDevPage({
  params,
  searchParams,
}: {
  params: Promise<{ franchise: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV !== 'development') notFound();
  const { franchise: slug } = await params;
  // Los modos apagados en data/mode.json también se pueden probar acá (por ejemplo, Nivel de poder de Dragon Ball).
  const visible = getFranchise(slug);
  const franchise = visible && allFranchises.find((candidate) => candidate.slug === slug);
  if (!franchise) notFound();
  const data = await loadFranchiseData(franchise.slug);
  const playable = franchise.modes.filter((mode) => modeStatus(franchise, mode, data) === 'playable');
  const modes = playable.map((mode) => ({ slug: mode.slug, name: mode.name, available: true }));
  const raw = await searchParams;
  const query = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
  return <VersusDev franchise={franchise} playable={playable} modes={modes} appShell={appShellEnabled(franchise.slug)} query={query} />;
}
