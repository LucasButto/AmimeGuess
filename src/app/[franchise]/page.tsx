import Link from 'next/link';
import { notFound } from 'next/navigation';
import { franchises, getFranchise } from '@/franchises';
import { es } from '@/i18n/es';
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

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{franchise.name}</h1>
      <p className={styles.text}>{es.franchise.provisional}</p>
      <Link className={styles.back} href="/">
        {es.franchise.backToHome}
      </Link>
    </main>
  );
}
