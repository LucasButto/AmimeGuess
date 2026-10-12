'use client';

import Link from 'next/link';
import { useSolvedToday } from '@/components/useSolvedToday';
import { es } from '@/i18n/es';
import styles from './FranchiseCard.module.scss';

interface FranchiseCardProps {
  slug: string;
  name: string;
  /** Los modos que se pueden jugar (los ocultos por falta de contenido no cuentan). */
  modes: readonly string[];
}

/** Tarjeta de una franquicia en el Home, con su tema y cuántos retos de hoy resolviste. */
export function FranchiseCard({ slug, name, modes }: FranchiseCardProps) {
  const solved = useSolvedToday(slug, modes);
  const done = solved !== null && modes.length > 0 && solved.size === modes.length;

  return (
    // `data-franchise` le da a la tarjeta las variables de su tema (ver `themeCss` con alcance de franquicia).
    <Link className={styles.card} href={`/${slug}`} data-franchise={slug}>
      <span className={styles.name}>{name}</span>
      {/* El renglón existe desde el principio: así la tarjeta no cambia de alto al leer el progreso. */}
      <span className={styles.progress} data-done={done}>
        {solved !== null && (
          <>
            {done && (
              <span aria-hidden="true" className={styles.check}>
                ✓{' '}
              </span>
            )}
            {done ? es.home.progressDone : es.home.progress(solved.size, modes.length)}
          </>
        )}
      </span>
    </Link>
  );
}
