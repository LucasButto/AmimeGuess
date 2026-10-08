import Link from 'next/link';
import { notFound } from 'next/navigation';
import { franchises, getFranchise } from '@/franchises';
import { loadFranchiseData } from '@/franchises/data';
import { es } from '@/i18n/es';
import { modeStatus } from './[mode]/playable';
import styles from './page.module.scss';

// Solo existen las franquicias de la config; cualquier otra ruta es 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return franchises.map((franchise) => ({ franchise: franchise.slug }));
}

export default async function FranchisePage({ params }: { params: Promise<{ franchise: string }> }) {
  const { franchise: slug } = await params;
  const franchise = getFranchise(slug);
  if (!franchise) notFound();

  // Solo se listan los modos que se pueden jugar: los que no alcanzan el pool mínimo con todas
  // las series activas no aparecen (SPEC 8). La grilla con su estado llega en la sesión 14.
  const data = await loadFranchiseData(franchise.slug);
  const playable = franchise.modes.filter((mode) => modeStatus(franchise, mode, data) === 'playable');

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{franchise.name}</h1>
      {playable.length === 0 ? (
        <p className={styles.text}>{es.franchise.provisional}</p>
      ) : (
        <ul className={styles.modes} aria-label={es.franchise.modesLabel}>
          {playable.map((mode) => (
            <li key={mode.slug}>
              <Link className={styles.mode} href={`/${franchise.slug}/${mode.slug}`}>
                {mode.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link className={styles.back} href="/">
        {es.franchise.backToHome}
      </Link>
    </main>
  );
}
