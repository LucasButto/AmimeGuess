import Link from 'next/link';
import { notFound } from 'next/navigation';
import { franchises, getFranchise } from '@/franchises';
import { es } from '@/i18n/es';
import styles from './page.module.scss';

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

  return (
    <main className={styles.page}>
      <p className={styles.franchise}>{franchise.name}</p>
      <h1 className={styles.title}>{mode.name}</h1>
      <p className={styles.text}>{es.mode.provisional}</p>
      <p className={styles.engine}>
        {es.mode.engineLabel}: {mode.engine}
      </p>
      <Link className={styles.back} href={`/${franchise.slug}`}>
        {es.mode.backToFranchise}
      </Link>
    </main>
  );
}
