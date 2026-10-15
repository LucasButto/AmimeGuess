'use client';

import { createContext, useContext, useId, type ReactNode } from 'react';
import { es } from '@/i18n/es';
import styles from './FilterPanel.module.scss';
import { useSkin } from './skin/context';
import { Chip } from './ui/Chip';
import type { GameToggle } from './game-shell/flags';
import { InfoTip } from './ui/InfoTip';
import { Panel } from './ui/Panel';
import { Switch } from './ui/Switch';

/** Cómo se llama lo que se cuenta en "N … posibles" ("personaje" / "personajes"). */
export interface PoolNoun {
  readonly one: string;
  readonly many: string;
}

/**
 * Lo que cuenta el contador de posibles en el modo de la página (las respuestas de un modo, sus formas, sus
 * sucesos…): lo da `ModeGame` desde la config, así ningún motor tiene que pasarlo. Sin valor, el contador no nombra nada.
 */
export const PoolNounContext = createContext<PoolNoun | undefined>(undefined);

interface FilterPanelProps {
  /** Ids de serie en orden canónico. */
  series: readonly string[];
  /** Nombre visible de cada serie. */
  labels: Readonly<Record<string, string>>;
  /** Un dato más de cada serie, visible desde `sm` (en el teléfono no entra). */
  details?: Readonly<Record<string, string>>;
  active: readonly string[];
  onChange: (next: string[]) => void;
  /** Cuántas entidades quedan elegibles con los filtros actuales. */
  remaining: number;
  /** Mínimo para poder jugar el modo (regla 6 de la SPEC). */
  minimum: number;
  /** Interruptores de la partida (relleno, arcos del manga), debajo de las series; cada uno con su ⓘ. */
  toggles?: readonly GameToggle[];
  /** Acciones que dependen de los filtros, al pie del panel (por ejemplo, copiar el link). */
  children?: ReactNode;
}

/**
 * Chips por serie: se apagan para excluir (SPEC 9). Muestra cuántas entidades
 * quedan, avisa si no alcanzan el mínimo e impide apagar la última serie.
 */
export function FilterPanel({ series, labels, details, active, onChange, remaining, minimum, toggles, children }: FilterPanelProps) {
  const { skin } = useSkin();
  const noun = useContext(PoolNounContext);
  const { ChipMark } = skin.slots;
  const titleId = useId();
  const keepOneId = useId();
  const onlyOne = active.length === 1;

  function toggle(id: string) {
    const isActive = active.includes(id);
    if (isActive && onlyOne) return;
    onChange(series.filter((candidate) => (candidate === id ? !isActive : active.includes(candidate))));
  }

  return (
    <Panel as="section" className={styles.root} aria-labelledby={titleId}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h2 className={styles.title} id={titleId}>
            {es.filters.title}
          </h2>
          <InfoTip compact text={es.help.filters} label={es.help.button(es.filters.title)} />
        </div>
        <p className={styles.count} role="status">
          {es.filters.remaining(remaining, noun)}
        </p>
      </div>
      <p className={styles.hint}>{es.filters.hint}</p>

      <ul className={styles.chips} data-uniform={skin.uniformFilterChips} aria-label={es.filters.groupLabel}>
        {series.map((id) => {
          const on = active.includes(id);
          const locked = on && onlyOne;
          return (
            <li key={id}>
              <Chip
                pressed={on}
                locked={locked}
                aria-describedby={locked ? keepOneId : undefined}
                onClick={() => toggle(id)}
                // La marca acompaña al color: el estado no depende solo de él.
                mark={<ChipMark on={on} id={id} />}
              >
                {labels[id] ?? id}
                {details?.[id] && <span className={styles.detail}>{details[id]}</span>}
              </Chip>
            </li>
          );
        })}
      </ul>

      {toggles && toggles.length > 0 && (
        <div className={styles.toggles}>
          {toggles.map((toggle) => (
            <div key={toggle.id} className={styles.toggle}>
              <Switch label={toggle.label} checked={toggle.on} onChange={toggle.onChange} />
              <InfoTip compact text={toggle.help} label={es.help.button(toggle.label)} />
            </div>
          ))}
        </div>
      )}
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
    </Panel>
  );
}
