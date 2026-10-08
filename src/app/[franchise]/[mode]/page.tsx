import Link from 'next/link';
import { notFound } from 'next/navigation';
import { franchises, getFranchise } from '@/franchises';
import { loadFranchiseData } from '@/franchises/data';
import { es } from '@/i18n/es';
import { ModeGame } from './ModeGame';
import styles from './page.module.scss';
import { modeStatus } from './playable';

// Solo existen los modos de la config de cada franquicia; cualquier otra ruta es 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return franchises.flatMap((franchise) =>
    franchise.modes.map((mode) => ({ franchise: franchise.slug, mode: mode.slug })),
  );
}

export default async function ModePage({
  params,
}: {
  params: Promise<{ franchise: string; mode: string }>;
}) {
  const { franchise: franchiseSlug, mode: modeSlug } = await params;
  const franchise = getFranchise(franchiseSlug);
  const mode = franchise?.modes.find((candidate) => candidate.slug === modeSlug);
  if (!franchise || !mode) notFound();

  // Los datos se leen al generar la página: con ellos se sabe qué modos tienen pool suficiente.
  // Los que no lo alcanzan con todas las series activas no aparecen en la navegación.
  const data = await loadFranchiseData(franchise.slug);
  const statuses = new Map(franchise.modes.map((candidate) => [candidate.slug, modeStatus(franchise, candidate, data)]));
  const modes = franchise.modes.flatMap((candidate) =>
    statuses.get(candidate.slug) === 'hidden'
      ? []
      : [{ slug: candidate.slug, name: candidate.name, available: statuses.get(candidate.slug) === 'playable' }],
  );

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.franchise}>{franchise.name}</p>
        <h1 className={styles.title}>{mode.name}</h1>
      </header>
      <ModeGame franchise={franchise} mode={mode} modes={modes} playable={statuses.get(mode.slug) === 'playable'} />
      <Link className={styles.back} href={`/${franchise.slug}`}>
        {es.mode.backToFranchise}
      </Link>
    </main>
  );
}
