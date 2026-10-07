'use client';

import { useId, type ReactNode } from 'react';
import { es } from '@/i18n/es';
import styles from './FilterPanel.module.scss';

interface FilterPanelProps {
  /** Ids de serie en orden canónico. */
  series: readonly string[];
  /** Nombre visible de cada serie. */
  labels: Readonly<Record<string, string>>;
  active: readonly string[];
  onChange: (next: string[]) => void;
  /** Cuántas entidades quedan elegibles con los filtros actuales. */
  remaining: number;
  /** Mínimo para poder jugar el modo (regla 6 de la SPEC). */
  minimum: number;
  /** Acciones que dependen de los filtros, al pie del panel (por ejemplo, copiar el link). */
  children?: ReactNode;
}

/**
 * Chips por serie: se apagan para excluir (SPEC 9). Muestra cuántas entidades
 * quedan, avisa si no alcanzan el mínimo e impide apagar la última serie.
 */
export function FilterPanel({ series, labels, active, onChange, remaining, minimum, children }: FilterPanelProps) {
  const titleId = useId();
  const keepOneId = useId();
  const onlyOne = active.length === 1;

  function toggle(id: string) {
    const isActive = active.includes(id);
    if (isActive && onlyOne) return;
    onChange(series.filter((candidate) => (candidate === id ? !isActive : active.includes(candidate))));
  }

  return (
    <section className={styles.root} aria-labelledby={titleId}>
      <div className={styles.header}>
        <h2 className={styles.title} id={titleId}>
          {es.filters.title}
        </h2>
        <p className={styles.count} role="status">
          {es.filters.remaining(remaining)}
        </p>
      </div>
      <p className={styles.hint}>{es.filters.hint}</p>

      <ul className={styles.chips} aria-label={es.filters.groupLabel}>
        {series.map((id) => {
          const on = active.includes(id);
          const locked = on && onlyOne;
          return (
            <li key={id}>
              <button
                type="button"
                className={styles.chip}
                aria-pressed={on}
                aria-disabled={locked}
                aria-describedby={locked ? keepOneId : undefined}
                onClick={() => toggle(id)}
              >
                {/* La tilde acompaña al color: el estado no depende solo de él. */}
                <span aria-hidden="true" className={styles.mark}>
                  {on ? '✓' : ''}
                </span>
                {labels[id] ?? id}
              </button>
            </li>
          );
        })}
      </ul>

      {onlyOne && (
        <p className={styles.note} id={keepOneId}>
          {es.filters.keepOne}
        </p>
      )}
      {remaining < minimum && (
        <p className={styles.warning} role="alert">
          {es.filters.belowMinimum(remaining, minimum)}
        </p>
      )}
      {children && <div className={styles.actions}>{children}</div>}
    </section>
  );
}
