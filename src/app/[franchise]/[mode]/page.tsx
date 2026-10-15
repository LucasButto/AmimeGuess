import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BackNav } from '@/components/BackNav';
import { TitleWords } from '@/components/TitleWords';
import { getSkin } from '@/franchises/themes';
import { franchises, getFranchise } from '@/franchises';
import { loadFranchiseData } from '@/franchises/data';
import { es } from '@/i18n/es';
import { OG_SIZE, ogImage } from '../../site';
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ franchise: string; mode: string }>;
}): Promise<Metadata> {
  const { franchise: franchiseSlug, mode: modeSlug } = await params;
  const franchise = getFranchise(franchiseSlug);
  const mode = franchise?.modes.find((candidate) => candidate.slug === modeSlug);
  if (!franchise || !mode) return {};
  const title = `${mode.name} · ${franchise.name}`;
  const description = es.meta.mode(mode.name, franchise.name);
  const url = `/${franchise.slug}/${mode.slug}`;
  const image = { url: ogImage(franchise.slug), ...OG_SIZE, alt: es.meta.imageAlt(franchise.name) };
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'website', siteName: es.site.name, locale: 'es_AR', title, description, url, images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  };
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

  // Animación de entrada del tema (slot `PageTransition`): no intercepta la navegación. Y la marca del modo antes del
  // título (slot `TitleMark`): por defecto, ninguna.
  const { PageTransition, TitleMark } = getSkin(franchise.slug).slots;

  return (
    <main className={styles.page}>
      <PageTransition />
      <BackNav franchise={franchise} />
      <header className={styles.header}>
        <p className={styles.franchise}>{franchise.name}</p>
        <h1 className={styles.title}>
          <TitleMark slug={mode.slug} index={franchise.modes.indexOf(mode)} />
          <TitleWords text={mode.name} />
        </h1>
      </header>
      {/* El área de juego va sobre la placa del tema: el texto nunca queda directo sobre el fondo. */}
      <div className={styles.plate}>
        <ModeGame franchise={franchise} mode={mode} modes={modes} playable={statuses.get(mode.slug) === 'playable'} />
      </div>
    </main>
  );
}
