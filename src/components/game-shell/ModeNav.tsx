'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import { Button } from '../ui/Button';
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
}

/** En móvil se exploran los modos con flechas y se entra tocando el nombre; desde tablet se ven todos. */
export function ModeNav({ franchise, modes, current, solved, filterKey, label = es.shell.modesLabel }: ModeNavProps) {
  const listId = useId();
  const [preview, setPreview] = useState<{ page: string; slug: string } | null>(null);
  const page = `${franchise}/${current}`;
  const selectedSlug = preview?.page === page ? preview.slug : current;
  const selectedIndex = Math.max(0, modes.findIndex((mode) => mode.slug === selectedSlug));
  const { skin, leaveTo } = useSkin();
  const { ModeIcon } = skin.slots;

  function browse(direction: -1 | 1) {
    if (modes.length < 2) return;
    const index = (selectedIndex + direction + modes.length) % modes.length;
    setPreview({ page, slug: modes[index].slug });
  }

  return (
    <nav className={styles.root} aria-label={label} data-part="mode-nav">
      <p className={styles.label}>{es.shell.modePickerTitle}</p>
      <Button variant="icon" tone="b" className={styles.previous} aria-label={es.shell.previousMode} aria-controls={listId} disabled={modes.length < 2} onClick={() => browse(-1)}>
        <PixelIcon name="cursor" className={styles.leftArrow} />
      </Button>
      <ul id={listId} className={styles.list}>
        {modes.map((mode, index) => {
          const isCurrent = mode.slug === current;
          const isSolved = solved?.has(mode.slug) ?? false;

          if (!mode.available) {
            return (
              <li key={mode.slug} data-visible={index === selectedIndex}>
                <span className={styles.pill} data-state="soon" aria-current={isCurrent ? 'page' : undefined}>
                  <ModeIcon slug={mode.slug} index={index} current={isCurrent} solved={false} />
                  {mode.name}
                  <VisuallyHidden> ({es.shell.modeSoon})</VisuallyHidden>
                </span>
              </li>
            );
          }

          return (
            <li key={mode.slug} data-visible={index === selectedIndex}>
              <Link
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
                <ModeIcon slug={mode.slug} index={index} current={isCurrent} solved={false} />
                {mode.name}
                {isSolved && <VisuallyHidden> ({es.shell.modeSolved})</VisuallyHidden>}
              </Link>
            </li>
          );
        })}
      </ul>
      <Button variant="icon" tone="b" className={styles.next} aria-label={es.shell.nextMode} aria-controls={listId} disabled={modes.length < 2} onClick={() => browse(1)}>
        <PixelIcon name="cursor" />
      </Button>
      <VisuallyHidden className={styles.announcement} role="status">
        {modes[selectedIndex]?.name}{modes[selectedIndex]?.slug === current ? ` · ${es.shell.currentMode}` : ''}
      </VisuallyHidden>
    </nav>
  );
}
