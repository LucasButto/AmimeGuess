'use client';

import Link from 'next/link';
import { useSolvedToday } from '@/components/useSolvedToday';
import { es } from '@/i18n/es';
import styles from './ModesGrid.module.scss';

interface ModesGridProps {
  franchise: string;
  /** Los modos que se pueden jugar, en orden. El primero es el principal y va destacado. */
  modes: ReadonlyArray<{ slug: string; name: string }>;
}

/**
 * Grilla de modos de la franquicia: cada uno con su estado de hoy (resuelto o pendiente) y el principal
 * destacado. El estado sale de las partidas guardadas, así que se conoce recién después de montar.
 */
export function ModesGrid({ franchise, modes }: ModesGridProps) {
  const solved = useSolvedToday(
    franchise,
    modes.map((mode) => mode.slug),
  );

  return (
    <>
      <p className={styles.progress} aria-live="polite">
        {solved !== null && es.franchise.progress(solved.size, modes.length)}
      </p>
      <ul className={styles.grid} aria-label={es.franchise.modesLabel}>
        {modes.map((mode, index) => {
          const isMain = index === 0;
          const isSolved = solved?.has(mode.slug) ?? false;
          return (
            <li key={mode.slug} className={styles.item} data-main={isMain}>
              <Link
                className={styles.card}
                href={`/${franchise}/${mode.slug}`}
                data-main={isMain}
                data-state={solved === null ? 'unknown' : isSolved ? 'solved' : 'pending'}
              >
                {isMain && <span className={styles.badge}>{es.franchise.mainMode}</span>}
                <span className={styles.name}>{mode.name}</span>
                {/* El estado se dice con texto y con un ícono, además del color del borde. */}
                <span className={styles.status}>
                  {solved !== null && (
                    <>
                      <span aria-hidden="true" className={styles.icon}>
                        {isSolved ? '✓' : '○'}
                      </span>{' '}
                      {isSolved ? es.franchise.solved : es.franchise.pending}
                    </>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
