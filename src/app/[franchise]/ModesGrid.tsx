'use client';

import Link from 'next/link';
import { ModeStateTag, modeStateText } from '@/components/ModeStateTag';
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
  /** Diseño de app: por debajo de `lg` el hub es una lista (la grilla de tarjetas queda para escritorio). */
  appShell?: boolean;
  /** Una línea de qué es cada modo, por slug (la lista del teléfono). */
  descriptions?: Readonly<Record<string, string>>;
}

/**
 * Grilla de modos de la franquicia: cada uno con su estado de hoy (resuelto o pendiente) y el principal
 * destacado. El estado sale de las partidas guardadas, así que se conoce recién después de montar. Cada
 * tarjeta la dibuja el slot `ModeCard` de la piel; la grilla (columnas y ancho) se ajusta con sus tokens.
 */
export function ModesGrid({ franchise, intro, modes, appShell = false, descriptions = {} }: ModesGridProps) {
  const { skin, leaveTo } = useSkin();
  const { ModeCard, ModeIcon, DailyReward } = skin.slots;
  const today = useTodayProgress(
    franchise,
    modes.map((mode) => mode.slug),
  );
  const solved = today?.solved ?? null;
  const stateOf = (slug: string): 'unknown' | 'won' | 'lost' | 'pending' =>
    today === null ? 'unknown' : today.lost.has(slug) ? 'lost' : today.solved.has(slug) ? 'won' : 'pending';

  return (
    <>
      {/* Presentación y progreso de hoy, sobre la placa del tema: el texto nunca va directo sobre el fondo. */}
      <div className={styles.plate}>
        <p className={styles.intro}>{intro}</p>
        <p className={styles.progress} aria-live="polite">
          {solved !== null && es.franchise.progress(solved.size, modes.length)}
        </p>
      </div>
      {/* Teléfono: lista con el Clásico destacado y una fila por modo (nombre, qué es y cómo te fue hoy). */}
      {appShell && (
        <ul className={styles.rows} aria-label={es.franchise.modesLabel}>
          {modes.map((mode, index) => {
            const state = stateOf(mode.slug);
            const href = `/${franchise}/${mode.slug}`;
            const stateText = modeStateText(state);
            return (
              <li key={mode.slug} className={styles.rowItem} data-main={index === 0}>
                <Link className={styles.row} href={href} data-state={state} onClick={(event) => leaveTo(event, href)} aria-label={state === 'unknown' ? mode.name : `${mode.name}: ${stateText}`}>
                  <span className={styles.rowIcon} aria-hidden="true">
                    <ModeIcon slug={mode.slug} index={index} current={false} solved={state === 'won'} variant="row" />
                  </span>
                  <span className={styles.rowText}>
                    <span className={styles.rowHead}>
                      <strong className={styles.rowName}>{mode.name}</strong>
                      {index !== 0 && <ModeStateTag state={state} />}
                    </span>
                    {index === 0 ? (
                      <ModeStateTag state={state} onBar />
                    ) : (
                      descriptions[mode.slug] && <span className={styles.rowLine}>{descriptions[mode.slug]}</span>
                    )}
                  </span>
                  {index === 0 && (
                    <span className={styles.rowPlay} aria-hidden="true">{state === 'won' || state === 'lost' ? es.franchise.continue : es.franchise.play}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {/* El aviso legal se muestra una vez en el teléfono; después vive en Créditos. */}
      {appShell && (
        <Link className={styles.creditsLink} href="/creditos">
          {es.footer.credits}
        </Link>
      )}
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
      {/* El premio visual del día (según los modos resueltos); la piel decide si hay y cómo se ve. */}
      {solved !== null && <DailyReward solved={solved.size} total={modes.length} solvedSlugs={solved} />}
    </>
  );
}

/** "N de M retos de hoy", para la barra superior del teléfono. Se lee del almacenamiento recién después de montar. */
export function HubBarProgress({ franchise, modes }: { franchise: string; modes: readonly string[] }) {
  const today = useTodayProgress(franchise, modes);
  return <span>{today === null ? ' ' : es.franchise.barProgress(today.solved.size, modes.length)}</span>;
}
