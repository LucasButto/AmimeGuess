import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BackNav } from '@/components/BackNav';
import { TitleWords } from '@/components/TitleWords';
import { franchises, getFranchise } from '@/franchises';
import { loadFranchiseData } from '@/franchises/data';
import { getSkin } from '@/franchises/themes';
import { es } from '@/i18n/es';
import { OG_SIZE, ogImage } from '../site';
import { modeStatus } from './[mode]/playable';
import { ModesGrid } from './ModesGrid';
import styles from './page.module.scss';

// Solo existen las franquicias de la config; cualquier otra ruta es 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return franchises.map((franchise) => ({ franchise: franchise.slug }));
}

/** Los modos de la franquicia que se pueden jugar: los que no alcanzan el pool mínimo con todas las series no aparecen (SPEC 8). */
async function playableModes(slug: string) {
  const franchise = getFranchise(slug);
  if (!franchise) return null;
  const data = await loadFranchiseData(franchise.slug);
  return { franchise, modes: franchise.modes.filter((mode) => modeStatus(franchise, mode, data) === 'playable') };
}

export async function generateMetadata({ params }: { params: Promise<{ franchise: string }> }): Promise<Metadata> {
  const { franchise: slug } = await params;
  const found = await playableModes(slug);
  if (!found) return {};
  const { franchise, modes } = found;
  const description = es.meta.franchise(franchise.name, modes.length);
  const image = { url: ogImage(franchise.slug), ...OG_SIZE, alt: es.meta.imageAlt(franchise.name) };
  return {
    title: franchise.name,
    description,
    alternates: { canonical: `/${franchise.slug}` },
    openGraph: { type: 'website', siteName: es.site.name, locale: 'es_AR', title: franchise.name, description, url: `/${franchise.slug}`, images: [image] },
    twitter: { card: 'summary_large_image', title: franchise.name, description, images: [image.url] },
  };
}

export default async function FranchisePage({ params }: { params: Promise<{ franchise: string }> }) {
  const { franchise: slug } = await params;
  const found = await playableModes(slug);
  if (!found) notFound();
  const { franchise, modes } = found;
  // Animación de entrada del tema (slot `PageTransition`): también al volver desde un modo con los botones de volver
  // (esos solo hacen su animación de salida; sin esto, la página de la franquicia aparecía sin abrirse).
  const { PageTransition } = getSkin(franchise.slug).slots;

  return (
    <main className={styles.page}>
      <PageTransition />
      <BackNav franchise={franchise} atFranchise />
      <header className={styles.header}>
        <p className={styles.site}>{es.site.name}</p>
        <h1 className={styles.title}>
          <TitleWords text={franchise.name} />
        </h1>
      </header>
      {modes.length === 0 ? (
        <p className={styles.plate}>{es.franchise.provisional}</p>
      ) : (
        <ModesGrid
          franchise={franchise.slug}
          intro={es.franchise.intro(franchise.name)}
          modes={modes.map((mode) => ({ slug: mode.slug, name: mode.name }))}
        />
      )}
    </main>
  );
}
