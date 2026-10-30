'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { type AutocompleteItem } from '@/components/Autocomplete';
import { Modal, type ModalOffset, type ModalSize } from '@/components/Modal';
import { buildSearchIndex } from '@/components/search';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { PixelIcon } from '@/components/ui/icons';
import { PixelArt } from '@/components/ui/PixelArt';
import { VisuallyHidden } from '@/components/VisuallyHidden';
import { es } from '@/i18n/es';
import type { GuessInputProps } from '../../types';
import { pokemonConfig } from '../config';
import { ChipBall } from './ChipBall';
import { TypeBadge } from './TypeBadge';
import { isTypeName } from './extras-art';
import { pokedexTypes } from './pokedexTypes';
import { PokedexPortrait } from './PokedexPortrait';
import { pokedexPortraitSize, pokedexPortraitUrl } from './pokedexPortraitData';
import { MONOTYPE_FILTER, availableGenerations, availableTypes, filterByFacets, type PokedexFilters } from './pokedexFilters';
import { PICKER_POKEDEX, POKEDEX_LENS, POKEDEX_LIGHT_ROWS, inlineArt } from './art';
import styles from './PokedexPicker.module.scss';

interface DialogProps {
  /** `null`: los de siempre, todo activo menos el guion. */
  filters: PokedexFilters | null;
  onFiltersChange: (filters: PokedexFilters | null) => void;
  items: readonly AutocompleteItem[];
  excludeIds: ReadonlySet<string>;
  onPick: (id: string) => void;
  onClose: () => void;
  /** Dónde y de qué tamaño se dejó la Pokédex la última vez (se arrastra desde la barra del título y se agranda desde la esquina). */
  offset: ModalOffset;
  size?: ModalSize;
  onMove: (offset: ModalOffset) => void;
  onResize: (size: ModalSize, offset: ModalOffset) => void;
}

/** La Pokédex abierta: un buscador y la grilla de todos los Pokémon posibles, en el orden de la Pokédex Nacional. */
/** Alto mínimo de la Pokédex: con los retratos, una fila completa de tres Pokémon tiene que verse sin scroll. */
const POKEDEX_MIN_HEIGHT_REM = 33.5;

function PickerDialog({ items, excludeIds, onPick, onClose, offset, size, onMove, onResize, filters, onFiltersChange }: DialogProps) {
  const searchId = useId();
  const filtersId = useId();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [coverBar, setCoverBar] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);
  const filterTriggerRef = useRef<HTMLSpanElement>(null);
  const closeFilters = useCallback(() => {
    setFiltersOpen(false);
    filterTriggerRef.current?.querySelector('button')?.focus({ preventScroll: true });
  }, []);
  const gridRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [stop, setStop] = useState<string | null>(null);
  const index = useMemo(() => buildSearchIndex(items), [items]);
  const generations = useMemo(() => availableGenerations(items), [items]);
  const plainTypes = useMemo(() => availableTypes(items), [items]);
  const types = useMemo(() => [...plainTypes, MONOTYPE_FILTER], [plainTypes]);
  // Por defecto todo activo (las generaciones son las series activas del modo, que ya recortan el pool) menos el guion.
  const activeFilters = useMemo(() => ({
    generations: (filters?.generations ?? generations).filter((value) => generations.includes(value)),
    types: (filters?.types ?? plainTypes).filter((value) => types.includes(value)),
  }), [filters, generations, plainTypes, types]);
  const monotype = activeFilters.types.includes(MONOTYPE_FILTER);
  const chosenTypes = activeFilters.types.filter((type) => type !== MONOTYPE_FILTER);
  const activeCount = generations.length - activeFilters.generations.length + plainTypes.length - chosenTypes.length + (monotype ? 1 : 0);
  // Todo activo no restringe; nada activo no muestra nada (una lista vacía, para filterByFacets, es "sin filtro").
  const facetQuery = useMemo(() => ({
    generations: activeFilters.generations.length === generations.length ? [] : activeFilters.generations.length ? activeFilters.generations : [-1],
    types: [...(chosenTypes.length === plainTypes.length ? [] : chosenTypes.length ? chosenTypes : ['']), ...(monotype ? [MONOTYPE_FILTER] : [])],
  }), [activeFilters, chosenTypes, generations, monotype, plainTypes]);
  const shown = useMemo(() => filterByFacets(items, facetQuery, query, index), [items, facetQuery, index, query]);
  const clearFilters = () => onFiltersChange(null);
  const firstFree = shown.find((item) => !excludeIds.has(item.id));
  // Un solo Pokémon es parada de Tab (los demás se alcanzan con las flechas): 1025 paradas serían inusables.
  const tabStop = (stop !== null && shown.some((item) => item.id === stop) ? stop : firstFree?.id) ?? null;

  // One observer for the whole grid; 1025 cells do not need state or resize subscriptions each.
  useEffect(() => {
    const grid = gridRef.current;
    const thumb = grid?.querySelector<HTMLElement>('[data-pmd-portrait]');
    if (!grid || !thumb) return;
    const resize = () => {
      const box = getComputedStyle(thumb);
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      grid.style.setProperty('--pmd-portrait-size', `${pokedexPortraitSize(parseFloat(box.width), parseFloat(box.height)) / rem}rem`);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(thumb);
    return () => observer.disconnect();
  }, [shown]);

  // Con un puntero fino (mouse), se puede escribir de una; en un teléfono, el teclado taparía la grilla.
  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) searchRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!filtersOpen) return;
    const panel = filtersRef.current;
    const bar = barRef.current;
    const body = bar?.closest<HTMLElement>('[data-part="modal-body"]');
    if (!panel || !bar || !body) return;
    // La altura depende también del tamaño que la persona dejó al redimensionar el modal.
    const fit = () => {
      // El panel nunca supera el alto del cuerpo del modal: si no entra, scrollea por dentro y «Listo» queda a mano.
      const cover = panel.scrollHeight + bar.offsetHeight > body.clientHeight;
      panel.style.setProperty('--filters-max', `${Math.max(0, body.clientHeight - (cover ? 0 : bar.offsetHeight))}px`);
      setCoverBar(cover);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(panel);
    observer.observe(bar);
    observer.observe(body);
    panel.querySelector('button')?.focus({ preventScroll: true });
    function outside(event: MouseEvent) {
      if (!(event.target instanceof Node) || panel?.contains(event.target) || filterTriggerRef.current?.contains(event.target)) return;
      // El primer clic exterior solo descarta el desplegable: nunca envía un intento.
      event.preventDefault();
      event.stopImmediatePropagation();
      closeFilters();
    }
    function escape(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closeFilters();
    }
    document.addEventListener('click', outside, true);
    document.addEventListener('keydown', escape, true);
    return () => {
      observer.disconnect();
      document.removeEventListener('click', outside, true);
      document.removeEventListener('keydown', escape, true);
    };
  }, [filtersOpen, closeFilters]);

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
    <Modal
      title={es.pokemonSkin.picker.title}
      onClose={onClose}
      wide
      minHeightRem={POKEDEX_MIN_HEIGHT_REM}
      className={styles.dialog}
      offset={offset}
      onMove={onMove}
      size={size}
      onResize={onResize}
      decoration={<HeaderLights />}
    >
      <div className={styles.picker}>
        <div className={styles.bar} ref={barRef}>
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
          <div className={styles.filterActions}>
            <span ref={filterTriggerRef}>
            <Button variant="ghost" aria-expanded={filtersOpen} aria-controls={filtersId}
              aria-label={es.pokemonSkin.picker.filtersAccessible(activeCount)}
              onClick={() => filtersOpen ? closeFilters() : setFiltersOpen(true)}>
              {es.pokemonSkin.picker.filters(activeCount)}
            </Button>
            </span>
            {activeCount > 0 && <Button variant="ghost" onClick={clearFilters}>{es.pokemonSkin.picker.clearFilters}</Button>}
          </div>

        <div id={filtersId} ref={filtersRef} hidden={!filtersOpen} className={styles.filters} data-cover-bar={coverBar}
          role="region" aria-label={es.pokemonSkin.picker.filtersPanel}>
          <div role="group" aria-label={es.pokemonSkin.picker.type}>
            <p className={styles.filterHeading}>{es.pokemonSkin.picker.type}</p>
            <div className={`${styles.chips} ${styles.typeChips}`}>
              {types.map((type) => {
                const pressed = activeFilters.types.includes(type);
                const mono = type === MONOTYPE_FILTER;
                return <Chip key={type} pressed={pressed} aria-label={mono ? es.pokemonSkin.picker.monotype : undefined} title={mono ? es.pokemonSkin.picker.monotypeHint : undefined} mark={isTypeName(type) ? <span className={styles.typeChipMark} data-on={pressed}><TypeBadge type={type} compact /></span> : undefined}
                  onClick={() => onFiltersChange({ ...activeFilters, types: pressed
                    ? activeFilters.types.filter((value) => value !== type)
                    : [...activeFilters.types, type] })}>{type}</Chip>;
              })}
            </div>
          </div>
          <div role="group" aria-label={es.pokemonSkin.picker.generation}>
            <p className={styles.filterHeading}>{es.pokemonSkin.picker.generation}</p>
            <div className={styles.chips}>
              {generations.map((generation) => {
                const id = `g${generation}` as keyof typeof pokemonConfig.seriesLabels;
                const pressed = activeFilters.generations.includes(generation);
                return <Chip key={generation} pressed={pressed} mark={<ChipBall on={pressed} id={id} />}
                  onClick={() => onFiltersChange({ ...activeFilters, generations: pressed
                    ? activeFilters.generations.filter((value) => value !== generation)
                    : [...activeFilters.generations, generation] })}>
                  {pokemonConfig.seriesLabels[id] ?? es.pokemonSkin.picker.generationNumber(generation)}
                </Chip>;
              })}
            </div>
          </div>
          <div className={styles.filterFooter}>
            <p>{es.pokemonSkin.picker.count(shown.length)}</p>
            {activeCount > 0 && <Button variant="ghost" onClick={clearFilters}>{es.pokemonSkin.picker.clearFilters}</Button>}
            <Button variant="secondary" onClick={closeFilters}>{es.pokemonSkin.picker.done}</Button>
          </div>
        </div>
        </div>

        {shown.length === 0 ? (
          <p className={styles.empty}>{activeCount > 0 ? es.pokemonSkin.picker.emptyFilters : es.pokemonSkin.picker.empty}</p>
        ) : (
          <ul ref={gridRef} className={styles.grid} aria-label={es.pokemonSkin.picker.gridLabel} onKeyDown={handleGridKey}>
            {shown.map((item) => {
              const tried = excludeIds.has(item.id);
              const itemTypes = pokedexTypes(item);
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
                    {itemTypes.length > 0 && <>
                      <span className={styles.types} aria-hidden="true">
                        {itemTypes.map((type) => <TypeBadge key={type} type={type} compact />)}
                      </span>
                      <VisuallyHidden> ({es.pokemonSkin.picker.itemTypes(itemTypes)})</VisuallyHidden>
                    </>}
                    <PokedexPortrait key={pokedexPortraitUrl(item, tried) ?? 'missing'} item={item} tried={tried} className={styles.thumb} />
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

/** Las luces de la barra del título de la Pokédex: las de la carcasa de la tabla de intentos. */
const HEADER_LIGHTS = ['red', 'yellow', 'grass-1'] as const;

/**
 * La lente a la izquierda y las tres luces arriba del título de la Pokédex (como en la carcasa de la tabla de intentos).
 * Son dos piezas sueltas dentro de la barra, que el estilo acomoda en una grilla: lente, luces arriba y título abajo.
 */
function HeaderLights() {
  return (
    <>
      <PixelArt art={inlineArt(POKEDEX_LENS)} size="fill" className={styles.headerLens} />
      <span className={styles.headerLights} aria-hidden="true">
        {HEADER_LIGHTS.map((color) => (
          <PixelArt
            key={color}
            art={inlineArt({ rows: POKEDEX_LIGHT_ROWS, colors: { K: 'frame', H: 'white', C: color } })}
            size="fill"
            className={styles.headerLight}
          />
        ))}
      </span>
    </>
  );
}

/**
 * El botón grande: la Pokédex de la navegación entre modos, más alta, y el texto al lado, dentro del marco del recuadro
 * de pistas. Con el cursor o el foco la pantalla se enciende con un parpadeo, como la de la tarjeta del Clásico en el
 * inicio.
 */
function DexButton({ count, disabled, onOpen }: { count: number; disabled: boolean; onOpen: () => void }) {
  return (
    <button type="button" className={styles.bigBall} disabled={disabled} aria-haspopup="dialog" data-picker-open="" onClick={onOpen}>
      <span className={styles.dex} aria-hidden="true">
        <PixelArt art={inlineArt(PICKER_POKEDEX)} size="fill" className={styles.dexArt} />
        <span className={styles.dexGlow} />
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
 * hecho; adentro hay un buscador para llegar rápido. Los que ya se probaron aparecen apagados. La Pokédex se puede
 * arrastrar desde su barra para ver la tabla de atrás y agrandar o achicar desde la esquina de abajo a la derecha
 * (con un mínimo); se vuelve a abrir donde y como se la dejó.
 */
export function PokedexPicker({ label, items, excludeIds, onSelect, disabled = false }: GuessInputProps) {
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<PokedexFilters | null>(null);
  // Dónde y de qué tamaño se dejó la Pokédex: al volver a abrirla (en el intento siguiente) aparece igual.
  const [offset, setOffset] = useState<ModalOffset>({ x: 0, y: 0 });
  const [size, setSize] = useState<ModalSize | undefined>(undefined);

  return (
    <div className={styles.root} role="group" aria-label={label}>
      <DexButton count={items.length} disabled={disabled} onOpen={() => setOpen(true)} />
      {open && (
        <PickerDialog
          filters={filters}
          onFiltersChange={setFilters}
          items={items}
          excludeIds={excludeIds}
          offset={offset}
          size={size}
          onMove={setOffset}
          onResize={(nextSize, nextOffset) => {
            setSize(nextSize);
            setOffset(nextOffset);
          }}
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
