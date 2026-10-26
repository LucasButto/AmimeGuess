'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { es } from '@/i18n/es';
import { useSkin } from '../skin/context';
import { PixelIcon } from '../ui/icons';
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
  /** Nombre de la navegación para lectores de pantalla; si hay dos en la página, el de la segunda tiene que ser otro. */
  label?: string;
  /** Si al montarse lleva el modo actual a la vista dentro de la fila (la navegación de arriba sí; la del final no). */
  revealCurrent?: boolean;
}

/**
 * Navegación entre los modos de la franquicia. En un teléfono es una fila que
 * se desplaza hacia los costados, con el modo actual a la vista; desde tablet
 * se acomoda en varias líneas. Los modos que todavía no existen se ven
 * apagados y sin link.
 */
export function ModeNav({ franchise, modes, current, solved, filterKey, label = es.shell.modesLabel, revealCurrent = true }: ModeNavProps) {
  const currentRef = useRef<HTMLElement | null>(null);
  const { skin, leaveTo } = useSkin();
  const { ModeIcon } = skin.slots;

  useEffect(() => {
    if (revealCurrent) currentRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [revealCurrent]);

  return (
    <nav aria-label={label} data-part="mode-nav">
      <ul className={styles.list}>
        {modes.map((mode, index) => {
          const isCurrent = mode.slug === current;
          const isSolved = solved?.has(mode.slug) ?? false;
          const setRef = isCurrent ? (element: HTMLElement | null) => void (currentRef.current = element) : undefined;

          if (!mode.available) {
            return (
              <li key={mode.slug}>
                <span ref={setRef} className={styles.pill} data-state="soon" aria-current={isCurrent ? 'page' : undefined}>
                  <ModeIcon slug={mode.slug} index={index} current={isCurrent} solved={false} />
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
                onClick={(event) => leaveTo(event, `/${franchise}/${mode.slug}${filterKey ? `?s=${filterKey}` : ''}`)}
                aria-current={isCurrent ? 'page' : undefined}
                data-state={isCurrent ? 'current' : isSolved ? 'solved' : 'idle'}
                data-solved={isSolved}
              >
                {isCurrent && (
                  <span aria-hidden="true" className={styles.cursor}>
                    <PixelIcon name="cursor" />
                  </span>
                )}
                <ModeIcon slug={mode.slug} index={index} current={isCurrent} solved={isSolved} />
                {mode.name}
                {isSolved && (
                  <>
                    {/* La tilde acompaña al color, si el tema la quiere: el estado no depende solo de él. */}
                    {skin.cellMarks === 'all' && (
                      <span aria-hidden="true" className={styles.check}>
                        ✓
                      </span>
                    )}
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
