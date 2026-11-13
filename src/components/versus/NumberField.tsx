'use client';

import { useId, useState } from 'react';
import { clampNumber } from './draft';
import styles from './NumberField.module.scss';

interface NumberFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Cómo se escribe el valor (por defecto, el número). */
  format?: (value: number) => string;
  /** Cómo se lee lo que se escribe; `null` si no se entiende (vuelve al valor anterior). */
  parse?: (text: string) => number | null;
  onChange: (value: number) => void;
  hint?: string;
  /** Nombres accesibles de los botones − y +. */
  lessLabel?: string;
  moreLabel?: string;
  /** Una línea corta: la etiqueta se oculta a la vista (queda para lectores de pantalla). */
  compact?: boolean;
}

/** Un campo numérico con − y + (áreas táctiles de 44 px): se puede tocar o escribir. Se acota a [min, max] de a `step`. */
export function NumberField({ label, value, min, max, step = 1, format = String, parse, onChange, hint, lessLabel, moreLabel, compact = false }: NumberFieldProps) {
  const id = useId();
  const hintId = useId();
  // Mientras se escribe, el campo muestra lo escrito; al salir se lee y se acota.
  const [typing, setTyping] = useState<string | null>(null);

  function commit(text: string) {
    setTyping(null);
    const parsed = parse ? parse(text) : text.trim() === '' || Number.isNaN(Number(text)) ? null : Number(text);
    if (parsed !== null) onChange(clampNumber(parsed, min, max, step));
  }

  return (
    <div className={styles.root} data-compact={compact || undefined}>
      <label className={styles.label} htmlFor={id}>{label}</label>
      <div className={styles.control}>
        <button type="button" className={styles.step} aria-label={lessLabel ?? `${label}: menos`} disabled={value <= min} onClick={() => onChange(clampNumber(value - step, min, max, step))}>
          <span aria-hidden="true">−</span>
        </button>
        <input
          id={id}
          className={styles.input}
          type="text"
          inputMode={parse ? 'text' : 'numeric'}
          autoComplete="off"
          value={typing ?? format(value)}
          aria-describedby={hint ? hintId : undefined}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => setTyping(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') setTyping(null);
          }}
        />
        <button type="button" className={styles.step} aria-label={moreLabel ?? `${label}: más`} disabled={value >= max} onClick={() => onChange(clampNumber(value + step, min, max, step))}>
          <span aria-hidden="true">+</span>
        </button>
      </div>
      {hint && <p className={styles.hint} id={hintId}>{hint}</p>}
    </div>
  );
}
