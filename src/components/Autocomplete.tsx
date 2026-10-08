'use client';

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { es } from '@/i18n/es';
import styles from './Autocomplete.module.scss';
import { ContentImage } from './ContentImage';
import { VisuallyHidden } from './VisuallyHidden';
import { buildSearchIndex, search, type SearchItem } from './search';

export interface AutocompleteItem extends SearchItem {
  /** Imagen de la opción, ver `ContentImage`. */
  imageStem?: string;
}

interface AutocompleteProps {
  label: string;
  /** Solo lo que se puede elegir: quien lo usa ya filtró por las series activas. */
  items: readonly AutocompleteItem[];
  /** Ids que no se ofrecen, por ejemplo los ya intentados. */
  excludeIds: ReadonlySet<string>;
  onSelect: (id: string) => void;
  disabled?: boolean;
}

/**
 * Campo de texto con sugerencias (patrón ARIA "combobox"). Se opera por
 * completo con teclado: flechas para moverse, Enter para elegir, Escape para
 * cerrar. Ofrece lo que empieza con lo escrito, por nombre o alias, sin
 * distinguir mayúsculas ni acentos.
 *
 * La lista muestra todas las coincidencias, sin tope: con una sola letra puede
 * ser larga, pero así nadie se queda sin ver la opción que busca. Se desplaza
 * dentro del panel y las miniaturas cargan en diferido.
 */
export function Autocomplete({ label, items, excludeIds, onSelect, disabled = false }: AutocompleteProps) {
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const listId = `${baseId}-list`;
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const index = useMemo(() => buildSearchIndex(items), [items]);
  const results = useMemo(() => search(index, query, { exclude: excludeIds }), [index, query, excludeIds]);

  const showPanel = open && query.trim().length > 0;
  const active = results.length === 0 ? -1 : Math.min(activeIndex, results.length - 1);

  // Con las flechas, la opción activa tiene que quedar a la vista dentro de la lista.
  useEffect(() => {
    if (showPanel && active >= 0) {
      document.getElementById(`${baseId}-option-${active}`)?.scrollIntoView({ block: 'nearest' });
    }
  }, [showPanel, active, baseId]);

  function choose(id: string) {
    onSelect(id);
    setQuery('');
    setOpen(false);
    setActiveIndex(0);
    inputRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!showPanel) setOpen(true);
        else if (results.length > 0) setActiveIndex((active + 1) % results.length);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!showPanel) setOpen(true);
        else if (results.length > 0) setActiveIndex((active - 1 + results.length) % results.length);
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
    // En el teléfono, el teclado tapa media pantalla: se sube el campo para que
    // quede visible junto con sus sugerencias.
    if (window.matchMedia('(pointer: coarse)').matches) {
      const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
      requestAnimationFrame(() => inputRef.current?.scrollIntoView({ block: 'start', behavior }));
    }
  }

  return (
    <div className={styles.root}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
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

      {showPanel && results.length > 0 && (
        <ul className={styles.list} id={listId} role="listbox" aria-label={label}>
          {results.map((item, position) => (
            <li
              key={item.id}
              id={`${baseId}-option-${position}`}
              className={styles.option}
              role="option"
              aria-selected={position === active}
              data-active={position === active}
              // Evita que el campo pierda el foco (y se cierre la lista) antes del clic.
              onPointerDown={(event) => event.preventDefault()}
              onPointerEnter={() => setActiveIndex(position)}
              onClick={() => choose(item.id)}
            >
              {item.imageStem && (
                <ContentImage className={styles.thumb} stem={item.imageStem} alt="" sizes="2rem" />
              )}
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      )}
      {showPanel && results.length === 0 && <p className={styles.empty}>{es.autocomplete.noResults}</p>}

      <VisuallyHidden role="status">
        {showPanel ? (results.length > 0 ? es.autocomplete.results(results.length) : es.autocomplete.noResults) : ''}
      </VisuallyHidden>
    </div>
  );
}
