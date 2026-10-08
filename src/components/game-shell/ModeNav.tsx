'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { es } from '@/i18n/es';
import { VisuallyHidden } from '../VisuallyHidden';
import styles from './ModeNav.module.scss';
import type { ModeLink } from './types';

interface ModeNavProps {
  franchise: string;
  modes: readonly ModeLink[];
  /** Slug del modo que se está jugando. */
  current: string;
  /** Slugs de los modos ya resueltos hoy con los filtros actuales. */
  solved?: ReadonlySet<string>;
  /** Con filtros activos, los links los conservan (`?s=`) para seguir jugando la misma combinación. */
  filterKey?: string;
}

/**
 * Navegación entre los modos de la franquicia. En un teléfono es una fila que
 * se desplaza hacia los costados, con el modo actual a la vista; desde tablet
 * se acomoda en varias líneas. Los modos que todavía no existen se ven
 * apagados y sin link.
 */
export function ModeNav({ franchise, modes, current, solved, filterKey }: ModeNavProps) {
  const currentRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, []);

  return (
    <nav aria-label={es.shell.modesLabel}>
      <ul className={styles.list}>
        {modes.map((mode) => {
          const isCurrent = mode.slug === current;
          const isSolved = solved?.has(mode.slug) ?? false;
          const setRef = isCurrent ? (element: HTMLElement | null) => void (currentRef.current = element) : undefined;

          if (!mode.available) {
            return (
              <li key={mode.slug}>
                <span ref={setRef} className={styles.pill} data-state="soon" aria-current={isCurrent ? 'page' : undefined}>
                  {mode.name}
                  <VisuallyHidden> ({es.shell.modeSoon})</VisuallyHidden>
                </span>
              </li>
            );
          }

          return (
            <li key={mode.slug}>
              <Link
                ref={setRef}
                className={styles.pill}
                href={`/${franchise}/${mode.slug}${filterKey ? `?s=${filterKey}` : ''}`}
                aria-current={isCurrent ? 'page' : undefined}
                data-state={isCurrent ? 'current' : isSolved ? 'solved' : 'idle'}
              >
                {mode.name}
                {isSolved && (
                  <>
                    {/* La tilde acompaña al color: el estado no depende solo de él. */}
                    <span aria-hidden="true" className={styles.check}>
                      ✓
                    </span>
                    <VisuallyHidden> ({es.shell.modeSolved})</VisuallyHidden>
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
