'use client';

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ContentImage } from '@/components/ContentImage';
import { buildSearchIndex, search } from '@/components/search';
import { VisuallyHidden } from '@/components/VisuallyHidden';
import { es } from '@/i18n/es';
import type { GuessInputProps } from '../../types';
import styles from './ScouterInput.module.scss';

/**
 * Slot `GuessInput` de Dragon Ball: el campo del intento es la lente de un rastreador (el scouter): un cristal verde
 * oscuro con reflejo, con la pieza que se apoya en la oreja a un costado. Lo que se escribe es la
 * lectura del scouter y las coincidencias se muestran como "objetivos": el que está marcado se ve grande, encuadrado y
 * con su nombre ("objetivo fijado"), y debajo va una tira con los retratos de todos para cambiar de objetivo.
 *
 * Es un campo con sugerencias (patrón ARIA "combobox"), igual que el de siempre: flechas para cambiar de objetivo, Enter
 * para elegir, Escape para cerrar; el renglón grande es solo una vista del objetivo marcado (decorativa), y cada retrato de
 * la tira es una opción con su nombre. Ofrece lo que coincide con lo escrito, por nombre o alias, sin distinguir
 * mayúsculas ni acentos, y no ofrece lo que ya se probó.
 */
export function ScouterInput({ label, items, excludeIds, onSelect, disabled = false }: GuessInputProps) {
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
  const target = active >= 0 ? results[active] : undefined;

  // Con las flechas, el retrato marcado tiene que quedar a la vista dentro de la tira.
  useEffect(() => {
    if (showPanel && active >= 0) {
      document.getElementById(`${baseId}-option-${active}`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [showPanel, active, baseId]);

  function choose(id: string) {
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
        // En el campo de una línea, las flechas laterales solo mueven el cursor: se usan para cambiar de objetivo
        // únicamente cuando la lista está abierta.
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
    // En el teléfono, el teclado tapa media pantalla: se sube el campo para que quede visible junto con las sugerencias.
    if (window.matchMedia('(pointer: coarse)').matches) {
      const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
      requestAnimationFrame(() => inputRef.current?.scrollIntoView({ block: 'start', behavior }));
    }
  }

  return (
    <div className={styles.scouter}>
      <span className={styles.arm} aria-hidden="true">
        <span className={styles.ear} />
      </span>
      <div className={styles.lens}>
        <span className={styles.glass} aria-hidden="true" />
        <p className={styles.scanning} aria-hidden="true">
          <span className={styles.dot} />
          {es.dragonBallSkin.scanning}
        </p>
        <label className={styles.label} htmlFor={inputId}>
          {label}
        </label>
        <div className={styles.fieldWrap}>
          <span className={styles.field}>
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
          </span>

          {showPanel && results.length > 0 && target && (
            <div className={styles.panel}>
              {/* El objetivo fijado: el marcado, grande y con su nombre. Es solo una vista: la opción es la de la tira. */}
              <div className={styles.lock} aria-hidden="true">
                <span className={styles.portrait}>
                  {target.imageStem && <ContentImage className={styles.portraitImage} stem={target.imageStem} alt="" sizes="9rem" priority />}
                </span>
                <span className={styles.lockText}>
                  <span className={styles.lockLabel}>{es.dragonBallSkin.locked}</span>
                  <span className={styles.lockName}>{target.label}</span>
                </span>
              </div>
              <ul className={styles.strip} id={listId} role="listbox" aria-label={label}>
                {results.map((item, position) => (
                  <li
                    key={item.id}
                    id={`${baseId}-option-${position}`}
                    className={styles.tile}
                    role="option"
                    aria-selected={position === active}
                    aria-label={item.label}
                    title={item.label}
                    data-active={position === active}
                    // Evita que el campo pierda el foco (y se cierre la lista) antes del clic.
                    onPointerDown={(event) => event.preventDefault()}
                    onPointerEnter={() => setActiveIndex(position)}
                    onClick={() => choose(item.id)}
                  >
                    {item.imageStem ? <ContentImage className={styles.thumb} stem={item.imageStem} alt="" sizes="4rem" /> : <span className={styles.initial}>{item.label.slice(0, 1)}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {showPanel && results.length === 0 && <p className={styles.empty}>{es.autocomplete.noResults}</p>}
        </div>

        <VisuallyHidden role="status">
          {showPanel ? (results.length > 0 ? es.autocomplete.results(results.length) : es.autocomplete.noResults) : ''}
        </VisuallyHidden>
      </div>
    </div>
  );
}
