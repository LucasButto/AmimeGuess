'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { useAppShell } from './AppShellContext';
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
  const appShell = useAppShell();
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  useEffect(() => {
    const list = listRef.current;
    if (!appShell || !list) return;
    const center = () => {
      // CSS decides whether this is the scrolling strip (including md tablets).
      if (getComputedStyle(list).overflowX !== 'auto') return;
      const current = list.querySelector<HTMLElement>('[aria-current="page"]');
      if (!current) return;
      const item = current.getBoundingClientRect();
      const box = list.getBoundingClientRect();
      list.scrollLeft += item.left - box.left + (item.width - list.clientWidth) / 2;
    };
    center();
    const observer = new ResizeObserver(center);
    observer.observe(list);
    return () => observer.disconnect();
  }, [appShell, current, modes]);
  const [preview, setPreview] = useState<{ page: string; slug: string } | null>(null);
  const page = `${franchise}/${current}`;
  const selectedSlug = preview?.page === page ? preview.slug : current;
  const selectedIndex = Math.max(0, modes.findIndex((mode) => mode.slug === selectedSlug));
  const { skin, leaveTo } = useSkin();
  const { ModeIcon } = skin.slots;
  const dropdown = appShell;
  const dropdownRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!dropdown) return;
    function closeOutside(event: Event) {
      const details = dropdownRef.current;
      if (!details?.open || !details.getClientRects().length || details.contains(event.target as Node)) return;
      details.open = false;
      if (event.type === 'click') {
        event.preventDefault();
        event.stopPropagation();
        details.querySelector('summary')?.focus({ preventScroll: true });
      }
    }
    document.addEventListener('click', closeOutside, true);
    document.addEventListener('touchmove', closeOutside, { capture: true, passive: true });
    document.addEventListener('wheel', closeOutside, { capture: true, passive: true });
    window.addEventListener('scroll', closeOutside);
    return () => {
      document.removeEventListener('click', closeOutside, true);
      document.removeEventListener('touchmove', closeOutside, true);
      document.removeEventListener('wheel', closeOutside, true);
      window.removeEventListener('scroll', closeOutside);
    };
  }, [dropdown]);
  const currentIndex = modes.findIndex((mode) => mode.slug === current);
  const currentMode = modes[currentIndex];

  function browse(direction: -1 | 1) {
    if (modes.length < 2) return;
    const index = (selectedIndex + direction + modes.length) % modes.length;
    setPreview({ page, slug: modes[index].slug });
  }

  function renderModes() {
    return modes.map((mode, index) => {
      const isCurrent = mode.slug === current;
      const isSolved = solved?.has(mode.slug) ?? false;
      const href = `/${franchise}/${mode.slug}${filterKey ? `?s=${filterKey}` : ''}`;

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
            href={href}
            onClick={(event) => {
              if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
                event.currentTarget.closest('details')?.removeAttribute('open');
              }
              leaveTo(event, href);
            }}
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
            {appShell && isSolved && <span className={styles.solvedDot} aria-hidden="true" />}
            {isSolved && <VisuallyHidden> ({es.shell.modeSolved})</VisuallyHidden>}
          </Link>
        </li>
      );
    });
  }

  return (
    <nav className={styles.root} aria-label={label} data-part="mode-nav" data-dropdown={dropdown || undefined}>
      {dropdown && currentMode && (
        <details ref={dropdownRef} className={styles.dropdown} onKeyDown={(event) => {
          if (event.key !== 'Escape' || !event.currentTarget.open) return;
          event.preventDefault();
          event.currentTarget.open = false;
          event.currentTarget.querySelector('summary')?.focus();
        }}>
          <summary className={`${styles.pill} ${styles.trigger}`} data-state="current">
            <ModeIcon slug={current} index={currentIndex} current solved={false} />
            {currentMode.name}
            <PixelIcon name="cursor" className={styles.downArrow} />
          </summary>
          <ul className={styles.dropdownList}>{renderModes()}</ul>
        </details>
      )}
      <p className={styles.label}>{es.shell.modePickerTitle}</p>
      <Button variant="icon" tone="b" className={styles.previous} aria-label={es.shell.previousMode} aria-controls={listId} disabled={modes.length < 2} onClick={() => browse(-1)}>
        <PixelIcon name="cursor" className={styles.leftArrow} />
      </Button>
      <ul id={listId} className={styles.list} ref={listRef}>
        {renderModes()}
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
