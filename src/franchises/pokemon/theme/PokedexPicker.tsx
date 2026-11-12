'use client';

import { useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { type AutocompleteItem } from '@/components/Autocomplete';
import { Modal, type ModalOffset, type ModalSize } from '@/components/Modal';
import { useAppShell } from '@/components/game-shell/AppShellContext';
import { ActiveAttemptLimit } from '@/components/game-shell/AttemptRules';
import { useInDock } from '@/components/game-shell/GameDock';
import { buildSearchIndex } from '@/components/search';
import { InfoTip } from '@/components/ui/InfoTip';
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
import { TYPE_MATCH_MODES, availableGenerations, availableTypes, filterByFacets, type PokedexFilters, type TypeMatchMode } from './pokedexFilters';
import { POKEDEX_LENS, POKEDEX_LIGHT_ROWS, inlineArt } from './art';
import styles from './PokedexPicker.module.scss';

interface DialogProps {
  /** `null`: todos los tipos y generaciones activos. */
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
  // Qué parte de los filtros está abierta: los tipos, las generaciones o las dos (el botón único de escritorio).
  const [panel, setPanel] = useState<'types' | 'generations' | 'all' | null>(null);
  const filtersOpen = panel !== null;
  const showsTypes = panel === 'types' || panel === 'all';
  const showsGenerations = panel === 'generations' || panel === 'all';
  // Con el diseño de app, la Pokédex a pantalla completa (un teléfono) cambia de forma: chips, 3 columnas y marcar + confirmar.
  const appShell = useAppShell();
  const [phone, setPhone] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);
  const filterControlsRef = useRef<HTMLDivElement>(null);
  const focusFilterTrigger = useCallback(() => {
    const controls = filterControlsRef.current;
    (controls?.querySelector<HTMLButtonElement>('button[aria-expanded="true"]') ??
      controls?.querySelector('button'))?.focus({ preventScroll: true });
  }, []);
  const closeFilters = useCallback(() => {
    setPanel(null);
    focusFilterTrigger();
  }, [focusFilterTrigger]);
  const gridRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [stop, setStop] = useState<string | null>(null);
  const index = useMemo(() => buildSearchIndex(items), [items]);
  const generations = useMemo(() => availableGenerations(items), [items]);
  const types = useMemo(() => availableTypes(items), [items]);
  // Las generaciones disponibles son las series activas del modo, que ya recortan el pool.
  const activeFilters = useMemo(() => ({
    typeMatch: filters?.typeMatch ?? 'any',
    generations: (filters?.generations ?? generations).filter((value) => generations.includes(value)),
    types: (filters?.types ?? types).filter((value) => types.includes(value)),
  }), [filters, generations, types]);
  const chosenTypes = activeFilters.types;
  const exactAvailable = chosenTypes.length === 1 || chosenTypes.length === 2;
  const typeMatch = activeFilters.typeMatch === 'exact' && !exactAvailable ? 'marked' : activeFilters.typeMatch;
  const activeCount = generations.length - activeFilters.generations.length + types.length - chosenTypes.length + (typeMatch !== 'any' ? 1 : 0);
  // Todo activo no restringe; nada activo no muestra nada (una lista vacía, para filterByFacets, es "sin filtro").
  const facetQuery = useMemo(() => ({
    typeMatch,
    generations: activeFilters.generations.length === generations.length ? [] : activeFilters.generations.length ? activeFilters.generations : [-1],
    types: typeMatch === 'any' && chosenTypes.length === types.length ? [] : chosenTypes.length ? chosenTypes : [''],
  }), [activeFilters.generations, chosenTypes, generations, types, typeMatch]);
  const matched = useMemo(() => filterByFacets(items, facetQuery, query, index), [items, facetQuery, index, query]);
  const shown = matched;
  const marked = phone && selected !== null ? shown.find((item) => item.id === selected && !excludeIds.has(item.id)) : undefined;
  const clearFilters = () => {
    focusFilterTrigger();
    onFiltersChange(null);
  };
  const firstFree = shown.find((item) => !excludeIds.has(item.id));
  // Un solo Pokémon es parada de Tab (los demás se alcanzan con las flechas): 1025 paradas serían inusables.
  const tabStop = (stop !== null && shown.some((item) => item.id === stop) ? stop : firstFree?.id) ?? null;

  function toggleType(type: string) {
    const next = activeFilters.types.includes(type)
      ? activeFilters.types.filter((value) => value !== type)
      : [...activeFilters.types, type];
    onFiltersChange({
      ...activeFilters,
      types: next,
      typeMatch: typeMatch === 'exact' && (next.length === 0 || next.length > 2) ? 'marked' : typeMatch,
    });
  }

  // Es "teléfono" cuando el diálogo ocupa todo el ancho (el mismo criterio con el que el Modal decide si se puede mover).
  const measurePhone = useCallback(() => {
    const dialog = appShell ? pickerRef.current?.closest('dialog') : null;
    if (dialog) setPhone(dialog.getBoundingClientRect().width >= window.innerWidth - 1);
  }, [appShell]);

  useLayoutEffect(() => {
    const dialog = appShell ? pickerRef.current?.closest('dialog') : null;
    if (!dialog) return;
    measurePhone();
    const observer = new ResizeObserver(measurePhone);
    observer.observe(dialog);
    return () => observer.disconnect();
  }, [appShell, measurePhone]);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

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

  useEffect(() => {
    if (!filtersOpen) return;
    const panel = filtersRef.current;
    const bar = barRef.current;
    const body = bar?.closest<HTMLElement>('[data-part="modal-body"]');
    if (!panel || !bar || !body) return;
    // La altura depende también del tamaño que la persona dejó al redimensionar el modal.
    const fit = () => {
      // El panel desplaza su contenido debajo de la barra, dejando visibles sus acciones.
      panel.style.setProperty('--filters-max', `${Math.max(0, body.clientHeight - bar.offsetHeight)}px`);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(bar);
    observer.observe(body);
    panel.querySelector('button')?.focus({ preventScroll: true });
    function outside(event: MouseEvent) {
      if (!(event.target instanceof Node) || panel?.contains(event.target) || filterControlsRef.current?.contains(event.target)) return;
      const tip = event.target instanceof Element && event.target.closest('[role="tooltip"]');
      if (tip && panel?.closest('dialog')?.contains(tip)) return;
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
    // En el teléfono, tocar marca y el botón de abajo (o un segundo toque en la misma tarjeta) confirma.
    if (phone && marked?.id !== id) {
      setSelected(id);
      return;
    }
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
      className={phone ? `${styles.dialog} ${styles.phone}` : styles.dialog}
      offset={offset}
      onMove={onMove}
      size={size}
      onResize={onResize}
      onOpen={measurePhone}
      decoration={<HeaderLights />}
    >
      <div className={styles.picker} ref={pickerRef} data-phone={phone || undefined}>
        <div className={styles.bar} ref={barRef}>
          {phone ? (
            <>
              <div className={styles.chipRow}>
                <Chip pressed={searchOpen} aria-label={es.pokemonSkin.picker.searchOpen} aria-expanded={searchOpen}
                  mark={<SearchGlyph />} onClick={() => setSearchOpen((open) => !open)}>
                  <VisuallyHidden>{es.pokemonSkin.picker.searchOpen}</VisuallyHidden>
                </Chip>
                <div ref={filterControlsRef} className={styles.chipGroup}>
                  <Chip pressed={false} aria-expanded={panel === 'types'} aria-controls={filtersId}
                    onClick={() => (panel === 'types' ? closeFilters() : setPanel('types'))}>{es.pokemonSkin.picker.typeChip}</Chip>
                  <Chip pressed={false} aria-expanded={panel === 'generations'} aria-controls={filtersId}
                    onClick={() => (panel === 'generations' ? closeFilters() : setPanel('generations'))}>{es.pokemonSkin.picker.generationChip}</Chip>
                  {activeCount > 0 && <Button variant="ghost" className={styles.phoneClear}
                    aria-label={es.pokemonSkin.picker.clearFilters} onClick={clearFilters}>{es.pokemonSkin.picker.clearFiltersShort}</Button>}
                </div>
              </div>
              {searchOpen && (
                <div className={styles.phoneSearch}>
                  <label className={styles.searchLabel} htmlFor={searchId}>{es.pokemonSkin.picker.search}</label>
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
                      if (event.key === 'Enter' && firstFree) {
                        event.preventDefault();
                        setSelected(firstFree.id);
                      }
                    }}
                  />
                  <p className={styles.count} role="status">{es.pokemonSkin.picker.count(shown.length)}</p>
                </div>
              )}
            </>
          ) : (
            <>
            <label className={styles.searchLabel} htmlFor={searchId}>
              {es.pokemonSkin.picker.search}
            </label>
            <input
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
            <div ref={filterControlsRef} className={styles.filterActions}>
              <Button variant="ghost" aria-expanded={filtersOpen} aria-controls={filtersId}
                aria-label={es.pokemonSkin.picker.filtersAccessible(activeCount)}
                onClick={() => (filtersOpen ? closeFilters() : setPanel('all'))}>
                {es.pokemonSkin.picker.filters(activeCount)}
              </Button>
              {activeCount > 0 && <Button variant="ghost" onClick={clearFilters}>{es.pokemonSkin.picker.clearFilters}</Button>}
            </div>

            </>
          )}

        <div id={filtersId} ref={filtersRef} hidden={!filtersOpen} className={styles.filters}
          role="region" aria-label={es.pokemonSkin.picker.filtersPanel}>
          {showsTypes && (<>
          <div role="group" aria-label={es.pokemonSkin.picker.types}>
            <p className={styles.filterHeading}>{es.pokemonSkin.picker.types}</p>
            <div className={`${styles.chips} ${styles.typeChips}`}>
              {types.map((type) => {
                const pressed = activeFilters.types.includes(type);
                return <Chip key={type} pressed={pressed} mark={isTypeName(type) ? <span className={styles.typeChipMark} data-on={pressed}><TypeBadge type={type} compact /></span> : undefined}
                  onClick={() => toggleType(type)}>{type}</Chip>;
              })}
              <button type="button" className={styles.facetReset} aria-label={es.pokemonSkin.picker.deselectTypes}
                onClick={() => onFiltersChange({ ...activeFilters, types: [], typeMatch: 'any' })}>
                {es.pokemonSkin.picker.deselectTypesShort}
              </button>
            </div>
          </div>
          <TypeMatchSelector phone={phone} mode={typeMatch} exactAvailable={exactAvailable}
            onChange={(typeMatch) => onFiltersChange({ ...activeFilters, typeMatch })} />
          </>)}
          {showsGenerations && (
          <div role="group" aria-label={es.pokemonSkin.picker.generations}>
            <p className={styles.filterHeading}>{es.pokemonSkin.picker.generations}</p>
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
              <button type="button" className={styles.facetReset} aria-label={es.pokemonSkin.picker.deselectGenerations}
                onClick={() => onFiltersChange({ ...activeFilters, generations: [] })}>
                {es.pokemonSkin.picker.deselectGenerationsShort}
              </button>
            </div>
          </div>
          )}
          <div className={styles.filterFooter}>
            <p role="status">{es.pokemonSkin.picker.count(shown.length)}</p>
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
                    aria-pressed={phone ? marked?.id === item.id : undefined}
                    data-selected={marked?.id === item.id || undefined}
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
        {marked && !filtersOpen && (
          <div className={styles.confirm}>
            <Button variant="primary" onClick={() => onPick(marked.id)}>{es.pokemonSkin.picker.choose(marked.label)}</Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function TypeMatchSelector({ phone, mode, exactAvailable, onChange }: {
  phone: boolean;
  mode: TypeMatchMode;
  exactAvailable: boolean;
  onChange: (mode: TypeMatchMode) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const optionsId = useId();
  const copy = es.pokemonSkin.picker;

  return (
    <div className={styles.matchSelector}>
      {phone && (
        <button type="button" className={styles.matchTrigger} ref={trigger}
          aria-expanded={expanded} aria-controls={optionsId} onClick={() => setExpanded(!expanded)}>
          <span>
            <span className={styles.matchLabel}>{copy.typeMatch}</span>
            <strong>{copy.typeMatchModes[mode].label}</strong>
          </span>
          <span className={styles.matchArrow} aria-hidden="true"><PixelIcon name="cursor" /></span>
        </button>
      )}
      <div className={styles.matchOptions} id={optionsId} hidden={phone && !expanded}
        role="group" aria-label={copy.typeMatch}>
        {TYPE_MATCH_MODES.map((option) => (
          <div className={styles.matchChoice} key={option}>
            <Chip pressed={mode === option}
              disabled={option === 'exact' && !exactAvailable}
              onClick={() => {
                onChange(option);
                if (phone) {
                  setExpanded(false);
                  trigger.current?.focus();
                }
              }}>
              {copy.typeMatchModes[option].label}
            </Chip>
            <InfoTip hoverParent className={styles.matchInfo} label={es.help.button(copy.typeMatchModes[option].label)}
              text={option === 'exact' && !exactAvailable
                ? `${copy.typeMatchModes[option].hint} ${copy.exactTypesUnavailable}`
                : copy.typeMatchModes[option].hint} />
          </div>
        ))}
      </div>
    </div>
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

/** La lupa de la fila de chips: pixel art de 12 × 12, del color del texto. */
function SearchGlyph() {
  return (
    <svg viewBox="0 0 12 12" width="16" height="16" aria-hidden="true" shapeRendering="crispEdges" className={styles.searchGlyph}>
      <path fillRule="evenodd" fill="currentColor" d="M3 1h4v1h1v1h1v4H8v1H7v1H3V8H2V7H1V3h1V2h1zm0 2v4h4V3zM8 8h1v1h1v1h1v1h-1v-1H9V9H8z" />
    </svg>
  );
}

/**
 * El botón grande: la Pokédex de la navegación entre modos, más alta, y el texto al lado, dentro del marco del recuadro
 * de pistas. Con el cursor o el foco la pantalla se enciende con un parpadeo, como la de la tarjeta del Clásico en el
 * inicio. En la barra inferior del teléfono es un botón rojo con la lente: "Abrir la Pokédex" y, debajo, cuántos Pokémon
 * quedan o en qué intento va.
 */
function DexButton({ count, tried, disabled, onOpen }: { count: number; tried: number; disabled: boolean; onOpen: () => void }) {
  const inDock = useInDock();
  const limit = useContext(ActiveAttemptLimit);
  const detail = inDock && tried > 0 && limit !== undefined ? es.pokemonSkin.picker.attemptOf(tried + 1, limit) : es.pokemonSkin.picker.available(count);
  return (
    <button type="button" className={styles.bigBall} disabled={disabled} aria-haspopup="dialog" data-picker-open="" onClick={onOpen}>
      {inDock ? (
        <PixelArt art={inlineArt(POKEDEX_LENS)} size="fill" className={styles.dockLens} />
      ) : (
        <img className={styles.dex} src="/icons/pokemon/pokedex.webp" alt="" width={200} height={200} draggable={false} aria-hidden="true" />
      )}
      <span className={styles.bigBallText}>
        <span className={styles.bigBallTitle}>
          {!inDock && (
            <span className={styles.go} aria-hidden="true">
              <PixelIcon name="cursor" />
            </span>
          )}
          {inDock ? es.pokemonSkin.picker.openDock : es.pokemonSkin.picker.open}
        </span>
        <span className={styles.bigBallCount}>{detail}</span>
      </span>
      {inDock && (
        <span className={styles.chevron} aria-hidden="true">
          <PixelIcon name="cursor" />
        </span>
      )}
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
      <DexButton count={items.length} tried={excludeIds.size} disabled={disabled} onOpen={() => setOpen(true)} />
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
