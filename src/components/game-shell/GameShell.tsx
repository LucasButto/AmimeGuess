'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getDay, msUntilNextDay } from '@/engine/day';
import { hasMinimumPool } from '@/engine/filters';
import { activeStreak, getLocalStorage, readState, readStats, recordResult } from '@/engine/storage';
import { es } from '@/i18n/es';
import { ContentImage } from '../ContentImage';
import { CopyLinkButton } from '../CopyLinkButton';
import { FilterPanel } from '../FilterPanel';
import { Modal } from '../Modal';
import { useSeriesFilters } from '../useSeriesFilters';
import { Countdown } from './Countdown';
import styles from './GameShell.module.scss';
import { ModeNav } from './ModeNav';
import { ResultPanel } from './ResultPanel';
import { StatsView } from './StatsView';
import { buildShareText, buildShareUrl, describeFilters } from './share';
import type { FinishReport, GameShellProps } from './types';

type Dialog = 'help' | 'stats' | null;

/**
 * Marco común de los juegos de una franquicia. Resuelve filtros, día,
 * navegación, ayuda, estadísticas, cuenta regresiva, "Ayer fue…" y compartir,
 * y monta el juego del motor. El contrato que tiene que cumplir un motor está
 * documentado al inicio de `types.ts`.
 *
 * Lee `window` y `localStorage` al montarse, así que solo se monta en el
 * cliente, después de la hidratación (ver `ModeGame`).
 */
export function GameShell({ franchise, mode, modes, minimumPool, poolSize, yesterday, help, children }: GameShellProps) {
  const { active, filterKey, setActive } = useSeriesFilters(franchise.slug, franchise.series);
  const [day, setDay] = useState(() => getDay(new Date()));
  const [stats, setStats] = useState(() => readStats(getLocalStorage(), franchise.slug, mode.slug));
  const [finished, setFinished] = useState<{ key: string; report: FinishReport } | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);

  // El reto cambia a medianoche (hora de Argentina): se reprograma al cruzarla y también al
  // volver a la pestaña, porque el navegador frena los temporizadores de una pestaña dormida.
  useEffect(() => {
    const refresh = () => setDay(getDay(new Date()));
    const timer = setTimeout(refresh, msUntilNextDay(new Date()) + 250);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [day]);

  const sessionKey = `${filterKey}:${day}`;
  const report = finished?.key === sessionKey ? finished.report : null;

  const remaining = useMemo(() => poolSize(active), [poolSize, active]);
  const playable = hasMinimumPool(remaining, minimumPool);

  const yesterdayAnswer = useMemo(
    () => (playable ? yesterday({ franchise: franchise.slug, mode: mode.slug, filterKey, day }, active) : null),
    [playable, yesterday, franchise.slug, mode.slug, filterKey, day, active],
  );

  // Modos ya resueltos hoy con estos filtros. Se vuelve a leer al terminar una partida.
  const solved = useMemo(() => {
    const storage = getLocalStorage();
    const finishedSlugs = modes
      .filter((candidate) => candidate.available)
      .filter((candidate) => {
        const state = readState(storage, { franchise: franchise.slug, mode: candidate.slug, filterKey, day });
        return state !== null && state.result !== 'playing';
      })
      .map((candidate) => candidate.slug);
    return new Set(finishedSlugs);
    // `report` no se usa adentro, pero cambia justo cuando se guarda una partida terminada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modes, franchise.slug, filterKey, day, report]);

  const handleFinish = useCallback(
    (reported: FinishReport) => {
      setFinished({ key: `${filterKey}:${day}`, report: reported });
      // Solo la partida que terminó ahora suma; una restaurada al recargar ya está contada.
      if (reported.fresh) {
        setStats(
          recordResult(getLocalStorage(), franchise.slug, mode.slug, { day, won: reported.won, attempts: reported.attempts }),
        );
      }
    },
    [filterKey, day, franchise.slug, mode.slug],
  );

  const getShareText = useCallback(() => {
    if (!report) return '';
    return buildShareText({
      franchiseName: franchise.name,
      modeName: mode.name,
      filters: describeFilters(active, franchise.series, franchise.seriesLabels),
      won: report.won,
      attempts: report.attempts,
      grid: report.grid,
      url: buildShareUrl(window.location.href, filterKey),
    });
  }, [report, franchise, mode.name, active, filterKey]);

  const closeDialog = () => setDialog(null);

  return (
    <div className={styles.root} data-game="shell">
      <ModeNav franchise={franchise.slug} modes={modes} current={mode.slug} solved={solved} filterKey={filterKey} />

      <div className={styles.toolbar}>
        <div className={styles.buttons}>
          <button type="button" className={styles.button} onClick={() => setDialog('help')}>
            {es.shell.help}
          </button>
          <button type="button" className={styles.button} onClick={() => setDialog('stats')}>
            {es.shell.stats}
          </button>
        </div>
        <Countdown />
      </div>

      {report && (
        <ResultPanel
          won={report.won}
          attempts={report.attempts}
          answer={report.answer}
          streak={activeStreak(stats, day)}
          getShareText={getShareText}
        />
      )}

      <FilterPanel
        series={franchise.series}
        labels={franchise.seriesLabels}
        active={active}
        onChange={setActive}
        remaining={remaining}
        minimum={minimumPool}
      >
        <CopyLinkButton filterKey={filterKey} />
      </FilterPanel>

      {/* Otra combinación de filtros o de día es otra partida: el juego se vuelve a montar. */}
      {playable && (
        <div key={sessionKey} className={styles.game}>
          {children({ franchise: franchise.slug, mode: mode.slug, day, filterKey, active, onFinish: handleFinish })}
        </div>
      )}

      {yesterdayAnswer && (
        <section className={styles.yesterday} aria-label={es.shell.yesterday}>
          {yesterdayAnswer.imageStem && (
            <ContentImage className={styles.yesterdayImage} stem={yesterdayAnswer.imageStem} alt="" sizes="3rem" />
          )}
          <p>
            <span className={styles.yesterdayLabel}>{es.shell.yesterday}</span>{' '}
            <strong>{yesterdayAnswer.label}</strong>
          </p>
        </section>
      )}

      {dialog === 'help' && (
        <Modal title={es.shell.helpTitle} onClose={closeDialog}>
          <div className={styles.help}>
            {help}
            <section>
              <h3 className={styles.helpTitle}>{es.shell.helpCommonTitle}</h3>
              <ul className={styles.helpList}>
                {es.shell.helpCommon.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          </div>
        </Modal>
      )}

      {dialog === 'stats' && (
        <Modal title={es.shell.statsView.title} onClose={closeDialog}>
          <StatsView stats={stats} streak={activeStreak(stats, day)} latestWin={report?.won ? report.attempts : undefined} />
        </Modal>
      )}
    </div>
  );
}
