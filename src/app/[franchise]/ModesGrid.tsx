'use client';

import { useSkin } from '@/components/skin/context';
import { useTodayProgress } from '@/components/useSolvedToday';
import { es } from '@/i18n/es';
import styles from './ModesGrid.module.scss';

interface ModesGridProps {
  franchise: string;
  /** Una línea de presentación de la franquicia, junto al progreso de hoy. */
  intro: string;
  /** Los modos que se pueden jugar, en orden. El primero es el principal y va destacado. */
  modes: ReadonlyArray<{ slug: string; name: string }>;
}

/**
 * Grilla de modos de la franquicia: cada uno con su estado de hoy (resuelto o pendiente) y el principal
 * destacado. El estado sale de las partidas guardadas, así que se conoce recién después de montar. Cada
 * tarjeta la dibuja el slot `ModeCard` de la piel; la grilla (columnas y ancho) se ajusta con sus tokens.
 */
export function ModesGrid({ franchise, intro, modes }: ModesGridProps) {
  const { ModeCard } = useSkin().skin.slots;
  const today = useTodayProgress(
    franchise,
    modes.map((mode) => mode.slug),
  );
  const solved = today?.solved ?? null;

  return (
    <>
      {/* Presentación y progreso de hoy, sobre la placa del tema: el texto nunca va directo sobre el fondo. */}
      <div className={styles.plate}>
        <p className={styles.intro}>{intro}</p>
        <p className={styles.progress} aria-live="polite">
          {solved !== null && es.franchise.progress(solved.size, modes.length)}
        </p>
      </div>
      <ul className={styles.grid} aria-label={es.franchise.modesLabel}>
        {modes.map((mode, index) => {
          const state = solved === null ? 'unknown' : solved.has(mode.slug) ? 'solved' : 'pending';
          return (
            <li key={mode.slug} className={styles.item} data-main={index === 0}>
              <ModeCard
                slug={mode.slug}
                name={mode.name}
                href={`/${franchise}/${mode.slug}`}
                index={index}
                state={state}
                attempts={today?.attempts.get(mode.slug)}
                label={es.franchise.cardLabel(mode.name, state)}
              />
            </li>
          );
        })}
      </ul>
    </>
  );
}
