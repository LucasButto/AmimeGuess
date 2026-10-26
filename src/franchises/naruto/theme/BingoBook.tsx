"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { ContentImage } from "@/components/ContentImage";
import { buildSearchIndex, search } from "@/components/search";
import { VisuallyHidden } from "@/components/VisuallyHidden";
import { es } from "@/i18n/es";
import type { GuessInputProps } from "../../types";
import styles from "./BingoBook.module.scss";

/**
 * Slot `GuessInput` de Naruto: el Libro Bingo. Cerrado es una libreta ninja de tapa de cuero, atada con un cordón, con su
 * título y una tira de papel donde se escribe el intento. Al escribir, el libro se abre debajo como dos páginas: a la
 * izquierda, la ficha de "se busca" del personaje marcado (retrato grande, nombre y un sello rojo); a la derecha, la lista
 * de fichas con su miniatura. En el teléfono las páginas van una arriba de la otra.
 *
 * Es un campo con sugerencias (patrón ARIA "combobox"), igual que el de siempre: flechas para cambiar de ficha, Enter
 * para elegir, Escape para cerrar. La ficha grande es solo una vista de la marcada (un clic también la elige); cada renglón
 * de la lista es una opción con su nombre. Ofrece lo que coincide con lo escrito, por nombre o alias, sin distinguir
 * mayúsculas ni acentos, y no ofrece lo que ya se probó.
 */
export function BingoBookInput({
  label,
  items,
  excludeIds,
  onSelect,
  disabled = false,
}: GuessInputProps) {
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const listId = `${baseId}-list`;
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const index = useMemo(() => buildSearchIndex(items), [items]);
  const results = useMemo(
    () => search(index, query, { exclude: excludeIds }),
    [index, query, excludeIds],
  );

  const showPanel = open && query.trim().length > 0;
  const active =
    results.length === 0 ? -1 : Math.min(activeIndex, results.length - 1);
  const wanted = active >= 0 ? results[active] : undefined;

  // Con las flechas, la ficha marcada tiene que quedar a la vista dentro de la lista.
  useEffect(() => {
    if (showPanel && active >= 0) {
      document
        .getElementById(`${baseId}-option-${active}`)
        ?.scrollIntoView({ block: "nearest" });
    }
  }, [showPanel, active, baseId]);

  function choose(id: string) {
    onSelect(id);
    setQuery("");
    setOpen(false);
    setActiveIndex(0);
    inputRef.current?.focus();
  }

  function move(step: number) {
    if (!showPanel) setOpen(true);
    else if (results.length > 0)
      setActiveIndex((active + step + results.length) % results.length);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        move(-1);
        break;
      case "Enter":
        if (showPanel && active >= 0) {
          event.preventDefault();
          choose(results[active].id);
        }
        break;
      case "Escape":
        if (showPanel) {
          event.preventDefault();
          setOpen(false);
        } else if (query) {
          setQuery("");
        }
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  function handleFocus() {
    setOpen(true);
    // En el teléfono, el teclado tapa media pantalla: se sube el campo para que quede visible junto con las sugerencias.
    if (window.matchMedia("(pointer: coarse)").matches) {
      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches
        ? "auto"
        : "smooth";
      requestAnimationFrame(() =>
        inputRef.current?.scrollIntoView({ block: "start", behavior }),
      );
    }
  }

  return (
    <div className={styles.book} data-open={showPanel}>
      {/* La tapa y las páginas van juntas en un ancla: las páginas se abren pegadas a la tapa aunque la caja del libro se
          estire (en una fila con otro panel más alto, por ejemplo). */}
      <div className={styles.anchor}>
        {/* La tapa: cuero con costuras, el lomo a la izquierda y el cordón que la ata. */}
        <div className={styles.cover}>
          <span className={styles.spine} aria-hidden="true" />
          <span className={styles.cord} aria-hidden="true" />
          <p className={styles.title} aria-hidden="true">
            {es.narutoSkin.bingoTitle}
          </p>
          <label className={styles.label} htmlFor={inputId}>
            {label}
          </label>
          <span className={styles.field}>
            <input
              ref={inputRef}
              id={inputId}
              className={styles.input}
              type="text"
              role="combobox"
              aria-expanded={showPanel && results.length > 0}
              aria-controls={
                showPanel && results.length > 0 ? listId : undefined
              }
              aria-autocomplete="list"
              aria-activedescendant={
                showPanel && active >= 0
                  ? `${baseId}-option-${active}`
                  : undefined
              }
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
        </div>

        {showPanel && results.length > 0 && wanted && (
          <div className={styles.spread}>
            {/* Página izquierda: la ficha de "se busca" de la marcada. Es una vista; un clic también la elige (el nombre
              accesible de la opción es el de la lista, así que no es una parada más para lectores de pantalla). */}
            <div
              className={styles.wanted}
              aria-hidden="true"
              // Evita que el campo pierda el foco (y se cierre la lista) antes del clic.
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => choose(wanted.id)}
            >
              <span className={styles.wantedLabel}>{es.narutoSkin.wanted}</span>
              <span className={styles.portrait}>
                {wanted.imageStem && (
                  <ContentImage
                    className={styles.portraitImage}
                    stem={wanted.imageStem}
                    alt=""
                    sizes="9rem"
                    priority
                  />
                )}
                <span className={styles.seal} />
              </span>
              <span className={styles.wantedName}>{wanted.label}</span>
            </div>

            {/* Página derecha: todas las fichas que coinciden. */}
            <ul
              className={styles.list}
              id={listId}
              role="listbox"
              aria-label={label}
            >
              {results.map((item, position) => (
                <li
                  key={item.id}
                  id={`${baseId}-option-${position}`}
                  className={styles.entry}
                  role="option"
                  aria-selected={position === active}
                  data-active={position === active}
                  // Evita que el campo pierda el foco (y se cierre la lista) antes del clic.
                  onPointerDown={(event) => event.preventDefault()}
                  onPointerEnter={() => setActiveIndex(position)}
                  onClick={() => choose(item.id)}
                >
                  <span className={styles.thumbBox} aria-hidden="true">
                    {item.imageStem ? (
                      <ContentImage
                        className={styles.thumb}
                        stem={item.imageStem}
                        alt=""
                        sizes="3rem"
                      />
                    ) : (
                      item.label.slice(0, 1)
                    )}
                  </span>
                  <span className={styles.entryName}>{item.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {showPanel && results.length === 0 && (
          <p className={styles.empty}>{es.autocomplete.noResults}</p>
        )}
      </div>

      <VisuallyHidden role="status">
        {showPanel
          ? results.length > 0
            ? es.autocomplete.results(results.length)
            : es.autocomplete.noResults
          : ""}
      </VisuallyHidden>
    </div>
  );
}
