'use client';

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { type AutocompleteItem } from '@/components/Autocomplete';
import { ContentImage } from '@/components/ContentImage';
import { Modal } from '@/components/Modal';
import { buildSearchIndex, search, type SearchIndex } from '@/components/search';
import { PixelIcon } from '@/components/ui/icons';
import { PixelArt } from '@/components/ui/PixelArt';
import { VisuallyHidden } from '@/components/VisuallyHidden';
import { es } from '@/i18n/es';
import type { GuessInputProps } from '../../types';
import ball from './BallCard.module.scss';
import { CARD_BALL_BOTTOM, CARD_BALL_TOP, PICKER_BALL_BUTTON, ballColors, inlineArt } from './art';
import styles from './PokedexPicker.module.scss';

/** Los que coinciden con lo escrito: por nombre (o alias) o por número, siempre en el orden de la Pokédex. */
function filterItems(items: readonly AutocompleteItem[], index: SearchIndex<AutocompleteItem>, query: string): AutocompleteItem[] {
  const text = query.trim();
  if (text === '') return [...items];
  const byNumber = /^\d+$/.test(text);
  const wanted = String(Number(text));
  const matches = byNumber ? items.filter((item) => item.number !== undefined && String(item.number).startsWith(wanted)) : search(index, text);
  return [...matches].sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
}

interface DialogProps {
  items: readonly AutocompleteItem[];
  excludeIds: ReadonlySet<string>;
  onPick: (id: string) => void;
  onClose: () => void;
}

/** La Pokédex abierta: un buscador y la grilla de todos los Pokémon posibles, en el orden de la Pokédex Nacional. */
function PickerDialog({ items, excludeIds, onPick, onClose }: DialogProps) {
  const searchId = useId();
  const gridRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [stop, setStop] = useState<string | null>(null);
  const index = useMemo(() => buildSearchIndex(items), [items]);
  const shown = useMemo(() => filterItems(items, index, query), [items, index, query]);
  const firstFree = shown.find((item) => !excludeIds.has(item.id));
  // Un solo Pokémon es parada de Tab (los demás se alcanzan con las flechas): 1025 paradas serían inusables.
  const tabStop = (stop !== null && shown.some((item) => item.id === stop) ? stop : firstFree?.id) ?? null;

  // Con un puntero fino (mouse), se puede escribir de una; en un teléfono, el teclado taparía la grilla.
  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) searchRef.current?.focus();
  }, []);

  function pick(id: string) {
    if (excludeIds.has(id)) return;
    onPick(id);
  }

  function handleGridKey(event: KeyboardEvent<HTMLUListElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    const cells = [...(gridRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
    const current = cells.indexOf(document.activeElement as HTMLButtonElement);
    if (current < 0) return;
    event.preventDefault();
    // Cuántos entran por fila: los que comparten el alto de la primera.
    const firstRowEnd = cells.findIndex((cell) => cell.offsetTop !== cells[0].offsetTop);
    const columns = firstRowEnd < 0 ? cells.length : firstRowEnd;
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns, Home: -current, End: cells.length };
    const next = Math.min(cells.length - 1, Math.max(0, current + (steps[event.key] ?? 0)));
    cells[next].focus();
  }

  return (
    <Modal title={es.pokemonSkin.picker.title} onClose={onClose} wide className={styles.dialog}>
      <div className={styles.picker}>
        <div className={styles.bar}>
          <label className={styles.searchLabel} htmlFor={searchId}>
            {es.pokemonSkin.picker.search}
          </label>
          <input
            ref={searchRef}
            id={searchId}
            className={styles.search}
            type="text"
            inputMode="search"
            enterKeyHint="go"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder={es.pokemonSkin.picker.placeholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              // Enter elige el primero de la lista, como en el campo de texto de siempre.
              if (event.key === 'Enter' && firstFree) {
                event.preventDefault();
                pick(firstFree.id);
              }
            }}
          />
          <p className={styles.count} role="status">
            {es.pokemonSkin.picker.count(shown.length)}
          </p>
        </div>

        {shown.length === 0 ? (
          <p className={styles.empty}>{es.pokemonSkin.picker.empty}</p>
        ) : (
          <ul ref={gridRef} className={styles.grid} aria-label={es.pokemonSkin.picker.gridLabel} onKeyDown={handleGridKey}>
            {shown.map((item) => {
              const tried = excludeIds.has(item.id);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={styles.cell}
                    data-tried={tried}
                    data-pokemon={item.id}
                    aria-disabled={tried || undefined}
                    tabIndex={item.id === tabStop ? 0 : -1}
                    onFocus={() => setStop(item.id)}
                    onClick={() => pick(item.id)}
                  >
                    {item.imageStem && <ContentImage className={styles.thumb} stem={item.imageStem} alt="" sizes="5rem" />}
                    {item.number !== undefined && <span className={styles.number}>{es.pokemonSkin.picker.number(item.number)}</span>}
                    <span className={styles.name}>{item.label}</span>
                    {tried && (
                      <>
                        <span className={styles.mark} aria-hidden="true">
                          <PixelIcon name="cross" />
                        </span>
                        <VisuallyHidden> ({es.pokemonSkin.picker.tried})</VisuallyHidden>
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}

/**
 * El botón grande: una Poké Ball de arte pixel (la de las tarjetas de modo, con un botón del medio más chico porque
 * no lleva ícono) y el texto al lado, dentro del marco del recuadro de pistas. Con el cursor o el foco la bola se balancea.
 */
function BigBall({ count, disabled, onOpen }: { count: number; disabled: boolean; onOpen: () => void }) {
  const colors = ballColors('red');

  return (
    <button type="button" className={styles.bigBall} disabled={disabled} aria-haspopup="dialog" data-picker-open="" onClick={onOpen}>
      <span className={`${ball.ball} ${styles.wobbler}`} aria-hidden="true">
        <PixelArt art={inlineArt({ rows: CARD_BALL_TOP, colors })} className={ball.top} />
        <PixelArt art={inlineArt({ rows: CARD_BALL_BOTTOM, colors })} className={ball.bottom} />
        <PixelArt art={inlineArt(PICKER_BALL_BUTTON)} className={styles.ballButton} />
      </span>
      <span className={styles.bigBallText}>
        <span className={styles.bigBallTitle}>
          <span className={styles.go} aria-hidden="true">
            <PixelIcon name="cursor" />
          </span>
          {es.pokemonSkin.picker.open}
        </span>
        <span className={styles.bigBallCount}>{es.pokemonSkin.picker.available(count)}</span>
      </span>
    </button>
  );
}

/**
 * Slot `GuessInput` de Pokémon: en lugar de escribir el nombre, un botón abre la Pokédex (un modal) con todos los
 * Pokémon posibles con las series activas, en el orden de la Pokédex Nacional. Se elige uno y el intento queda
 * hecho; adentro hay un buscador para llegar rápido. Los que ya se probaron aparecen apagados.
 */
export function PokedexPicker({ label, items, excludeIds, onSelect, disabled = false }: GuessInputProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.root} role="group" aria-label={label}>
      <BigBall count={items.length} disabled={disabled} onOpen={() => setOpen(true)} />
      {open && (
        <PickerDialog
          items={items}
          excludeIds={excludeIds}
          onClose={() => setOpen(false)}
          onPick={(id) => {
            setOpen(false);
            onSelect(id);
          }}
        />
      )}
    </div>
  );
}
