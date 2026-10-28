'use client';

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Entity } from '@/engine/types';
import { ContentImage } from '@/components/ContentImage';
import { buildSearchIndex, search } from '@/components/search';
import { VisuallyHidden } from '@/components/VisuallyHidden';
import { es } from '@/i18n/es';
import type { GuessInputProps } from '../../types';
import { AnimeCard } from './AnimeCard';
import { classFrame } from './gamePresentation';
import styles from './DuelDiskInput.module.scss';

/** Cuántas cartas entran a la vez en las zonas: 5 en pantalla grande y 3 en el teléfono. */
function useZoneCount(): number {
  const [count, setCount] = useState(3);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 48rem)');
    const sync = () => setCount(query.matches ? 5 : 3);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  return count;
}

/** Marco de la carta según su clase; los duelistas (sin clase) llevan el suyo. */
function frameOf(attrs: Readonly<Record<string, unknown>> | undefined): string {
  return typeof attrs?.clase === 'string' ? classFrame(attrs.clase) : 'duelist';
}

/**
 * Slot `GuessInput` de Yu-Gi-Oh: un disco de duelo. El campo del intento es su pantalla de puntos de vida; al escribir se
 * despliegan las alas y las coincidencias llenan las zonas como cartas, con la marcada grande como holograma.
 *
 * Es un combobox (patrón ARIA) como los demás buscadores: flechas para marcar, Enter para elegir, Escape para cerrar. La
 * vista grande es solo una vista; cada carta de las zonas es una opción con su nombre. Ofrece lo que coincide por nombre o
 * alias, sin distinguir mayúsculas ni acentos, y no ofrece lo ya probado.
 */
export function DuelDiskInput({ label, items, excludeIds, onSelect, disabled = false }: GuessInputProps) {
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const listId = `${baseId}-list`;
  const root = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [chainTarget, setChainTarget] = useState<HTMLElement | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [sent, setSent] = useState<{ stem?: string; label: string; key: number } | null>(null);
  const zoneCount = useZoneCount();

  useLayoutEffect(() => {
    // La leyenda de la cadena se coloca antes del primer paint del tablero: no cambia de sitio al verse.
    const target = root.current?.closest('[data-game-ready]')?.querySelector('ol:has(> li[data-revealed])')?.parentElement;
    if (target) setChainTarget(target);
  }, []);
  useEffect(() => {
    if (!sent) return;
    const timer = window.setTimeout(() => setSent(null), 900);
    return () => window.clearTimeout(timer);
  }, [sent]);

  const index = useMemo(() => buildSearchIndex(items), [items]);
  const results = useMemo(() => search(index, query, { exclude: excludeIds }), [index, query, excludeIds]);
  const showPanel = open && query.trim().length > 0;
  const active = results.length === 0 ? -1 : Math.min(activeIndex, results.length - 1);
  const target = active >= 0 ? results[active] : undefined;
  // La ventana de cartas avanza cuando la marcada pasa del borde.
  const start = results.length <= zoneCount ? 0 : Math.min(Math.max(active - zoneCount + 1, 0), results.length - zoneCount);
  const shown = results.slice(start, start + zoneCount);

  function choose(id: string) {
    const item = results.find((entry) => entry.id === id);
    if (item) setSent({ stem: item.imageStem, label: item.label, key: Date.now() });
    onSelect(id);
    setQuery('');
    setOpen(false);
    setActiveIndex(0);
    inputRef.current?.focus();
  }

  function move(step: number) {
    if (!showPanel) setOpen(true);
    else if (results.length > 0) setActiveIndex((active + step + results.length) % results.length);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        // Con el panel cerrado, la flecha lateral solo mueve el cursor del campo.
        if (event.key === 'ArrowRight' && !showPanel) break;
        event.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        if (event.key === 'ArrowLeft' && !showPanel) break;
        event.preventDefault();
        move(-1);
        break;
      case 'Enter':
        if (showPanel && active >= 0) {
          event.preventDefault();
          choose(results[active].id);
        }
        break;
      case 'Escape':
        if (showPanel) {
          event.preventDefault();
          setOpen(false);
        } else if (query) {
          setQuery('');
        }
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  }

  function handleFocus() {
    setOpen(true);
    // En el teléfono el teclado tapa media pantalla: se sube el campo para ver las sugerencias.
    if (window.matchMedia('(pointer: coarse)').matches) {
      const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
      requestAnimationFrame(() => inputRef.current?.scrollIntoView({ block: 'start', behavior }));
    }
  }

  const entityOf = (item: NonNullable<typeof target>): Entity => ({ id: item.id, name: { es: item.label }, attrs: item.attrs ?? {}, image: item.imageStem } as Entity);

  return (
    <div ref={root} className={styles.root}>
      {chainTarget && createPortal(<p className={styles.chain} data-duel-chain-label>{es.yugiohGames.chain}</p>, chainTarget)}
      <div className={styles.disk} data-duel-disk data-open={showPanel && results.length > 0} data-disabled={disabled}>
        <div className={styles.row}>
          <span className={styles.zone} aria-hidden="true" data-lit={showPanel && results.length > 0}>
            {sent?.stem
              ? <ContentImage key={sent.key} className={styles.sent} stem={sent.stem} alt="" sizes="4rem" />
              : target?.imageStem && showPanel
                ? <ContentImage className={styles.sent} stem={target.imageStem} alt="" sizes="4rem" />
                : <span className={styles.plus}>+</span>}
          </span>
          <div className={styles.field} data-duel-screen>
            <label className={styles.label} htmlFor={inputId}>{es.yugiohDisk.invoke}</label>
            <input
              ref={inputRef}
              id={inputId}
              className={styles.input}
              type="text"
              role="combobox"
              aria-expanded={showPanel && results.length > 0}
              aria-controls={showPanel && results.length > 0 ? listId : undefined}
              aria-autocomplete="list"
              aria-activedescendant={showPanel && active >= 0 ? `${baseId}-option-${active}` : undefined}
              placeholder={es.autocomplete.placeholder}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              disabled={disabled}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeyDown}
              onFocus={handleFocus}
              onBlur={() => setOpen(false)}
            />
          </div>
        </div>
        {showPanel && results.length === 0 && <p className={styles.empty} data-duel-empty>{es.yugiohDisk.emptyScreen}</p>}
        {showPanel && results.length > 0 && target && (
          <div className={styles.panel} data-duel-panel>
            <div
              className={styles.hologram}
              data-duel-hologram
              data-frame={frameOf(target.attrs)}
              aria-hidden="true"
              // Evita que el campo pierda el foco (y se cierre el panel) antes del clic.
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => choose(target.id)}
            >
              <span className={styles.holo} key={target.id}>
                {frameOf(target.attrs) === 'duelist'
                  ? <span className={styles.duelist}>
                      {target.imageStem && <ContentImage className={styles.duelistImage} stem={target.imageStem} alt="" sizes="12rem" priority />}
                      <span className={styles.duelistName}>{target.label}</span>
                      <span className={styles.duelistRole}>{es.yugiohDisk.duelist}</span>
                    </span>
                  : <>
                      <AnimeCard card={entityOf(target)} />
                      <span className={styles.holoName}>{target.label}</span>
                    </>}
              </span>
            </div>
            <div className={styles.zones}>
              <ul className={styles.list} id={listId} role="listbox" aria-label={label}>
                {shown.map((item, offset) => {
                  const position = start + offset;
                  return (
                    <li
                      key={item.id}
                      id={`${baseId}-option-${position}`}
                      className={styles.card}
                      role="option"
                      aria-selected={position === active}
                      aria-label={item.label}
                      title={item.label}
                      data-active={position === active}
                      data-frame={frameOf(item.attrs)}
                      onPointerDown={(event) => event.preventDefault()}
                      onPointerEnter={() => setActiveIndex(position)}
                      onClick={() => choose(item.id)}
                    >
                      {item.imageStem ? <ContentImage className={styles.thumb} stem={item.imageStem} alt="" sizes="6rem" /> : <span className={styles.initial}>{item.label.slice(0, 1)}</span>}
                    </li>
                  );
                })}
              </ul>
              <p className={styles.count} aria-hidden="true">
                {es.yugiohDisk.total(results.length)}
                {results.length > zoneCount && <span>{es.yugiohDisk.window(start + 1, start + shown.length, results.length)}</span>}
              </p>
            </div>
          </div>
        )}
      </div>
      <VisuallyHidden role="status">
        {showPanel ? (results.length > 0 ? es.autocomplete.results(results.length) : es.autocomplete.noResults) : ''}
      </VisuallyHidden>
    </div>
  );
}
