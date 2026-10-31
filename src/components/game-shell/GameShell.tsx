'use client';

import { useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getDay, msUntilNextDay } from '@/engine/day';
import { hasMinimumPool } from '@/engine/filters';
import { activeStreak, getLocalStorage, readState, readStats, recordResult, writeState } from '@/engine/storage';
import { es } from '@/i18n/es';
import { ContentImage } from '../ContentImage';
import { CopyLinkButton } from '../CopyLinkButton';
import { FilterPanel } from '../FilterPanel';
import { Modal } from '../Modal';
import { setPrefs, usePrefs } from '../usePrefs';
import { useSkin } from '../skin/context';
import { useSound } from '../skin/useSound';
import { Button } from '../ui/Button';
import { Panel } from '../ui/Panel';
import { InfoTip } from '../ui/InfoTip';
import { Switch } from '../ui/Switch';
import { useSeriesFilters } from '../useSeriesFilters';
import { Countdown } from './Countdown';
import { GameFlagsContext } from './flags';
import styles from './GameShell.module.scss';
import { ModeNav } from './ModeNav';
import { clearPracticeStates, newPracticeDay, practiceStorage } from './practice';
import { ResultPanel } from './ResultPanel';
import { scrollToElement } from './scroll';
import { StatsView } from './StatsView';
import { buildShareText, buildShareUrl, describeFilters, themeGrid } from './share';
import type { FinishReport, GameShellProps } from './types';
import { ActiveAttemptLimit, AttemptRules } from './AttemptRules';
import { attemptLimit } from './attempts';

import { useRouletteImages } from '@/modes/stat-builder/RoulettePreview';

type Dialog = 'help' | 'stats' | 'settings' | null;

/**
 * Marco común de los juegos de una franquicia. Resuelve filtros, día,
 * navegación, ayuda, estadísticas, cuenta regresiva, "Ayer fue…" y compartir,
 * y monta el juego del motor. El contrato que tiene que cumplir un motor está
 * documentado al inicio de `types.ts`.
 *
 * Lee `window` y `localStorage` al montarse, así que solo se monta en el
 * cliente, después de la hidratación (ver `ModeGame`).
 */
export function GameShell({
  franchise,
  mode,
  modes,
  resultKind = 'attempts',
  gridKind = 'marks',
  minimumPool,
  poolSize,
  yesterday,
  help,
  variant: engineVariant,
  beforeGame,
  children,
}: GameShellProps) {
  // La variante de la partida: la del motor (una dificultad) más la de los interruptores (relleno, arcos del manga).
  const flags = useContext(GameFlagsContext);
  const attemptRules = useContext(AttemptRules);
  const variant = `${engineVariant ?? ''}${flags.variant}` || undefined;
  const { active, filterKey, setActive } = useSeriesFilters(franchise.slug, franchise.series);
  useRouletteImages(active);
  const [day, setDay] = useState(() => getDay(new Date()));
  const [stats, setStats] = useState(() => readStats(getLocalStorage(), franchise.slug, mode.slug));
  const [finished, setFinished] = useState<{ key: string; report: FinishReport } | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const { skin } = useSkin();
  const prefs = usePrefs();
  const play = useSound();

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

  // Modo infinito: el "día" de la partida extra que se está jugando, o `null` si se juega el reto de hoy.
  const [practiceDay, setPracticeDay] = useState<number | null>(null);
  const practicing = practiceDay !== null;
  const playDay = practiceDay ?? day;
  const sessionKey = `${filterKey}:${playDay}${variant ? `:${variant}` : ''}`;
  const report = finished?.key === sessionKey ? finished.report : null;

  // Al terminar una partida (no al recargar una ya terminada), la página baja sola hasta el resumen.
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = resultRef.current;
    if (!report?.fresh || !target) return;
    return scrollToElement(target);
  }, [report]);

  // Al empezar una partida del modo infinito, baja sola hasta el juego.
  const gameRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = gameRef.current;
    if (practiceDay === null || !target) return;
    return scrollToElement(target);
  }, [practiceDay]);

  const startPractice = useCallback(() => {
    clearPracticeStates(practiceStorage());
    setPracticeDay(newPracticeDay());
  }, []);

  const leavePractice = useCallback(() => {
    clearPracticeStates(practiceStorage());
    setPracticeDay(null);
  }, []);

  const remaining = useMemo(() => poolSize(active), [poolSize, active]);
  const fullPool = useMemo(() => poolSize(franchise.series), [poolSize, franchise.series]);
  const limit = attemptRules ? attemptLimit(attemptRules.base, remaining, fullPool, attemptRules.adaptive) : undefined;
  const playable = hasMinimumPool(remaining, minimumPool);

  const yesterdayAnswer = useMemo(
    () =>
      playable
        ? yesterday({ franchise: franchise.slug, mode: mode.slug, filterKey: variant ? `${filterKey}~${variant}` : filterKey, day }, active)
        : null,
    [playable, yesterday, franchise.slug, mode.slug, filterKey, variant, day, active],
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
      // También cierra partidas restauradas que agotaron el límite nuevo.
      const ctx = { franchise: franchise.slug, mode: mode.slug, filterKey: variant ? `${filterKey}~${variant}` : filterKey, day: playDay };
      const saved = readState(getLocalStorage(), ctx);
      const result = reported.won ? 'won' : 'lost';
      if (saved && saved.result !== result) writeState(getLocalStorage(), ctx, { ...saved, result });
      setFinished({ key: sessionKey, report: reported });
      // Solo la partida que terminó ahora suma; una restaurada al recargar ya está contada.
      if (reported.fresh) {
        // Fanfarria del tema (si hay sonidos) al ganar un reto de intentos; los de puntaje no se "ganan".
        if (reported.won && reported.score === undefined) play('win');
        // Una partida del modo infinito no cuenta para las estadísticas ni para la racha.
        if (practicing) return;
        setStats(
          // En un modo de puntaje las estadísticas guardan el puntaje donde los demás guardan los intentos.
          recordResult(getLocalStorage(), franchise.slug, mode.slug, {
            day,
            won: reported.won,
            attempts: reported.score ?? reported.attempts,
          }),
        );
      }
    },
    [sessionKey, practicing, day, franchise.slug, mode.slug, play, filterKey, variant, playDay],
  );

  const getShareText = useCallback(() => {
    if (!report) return '';
    return buildShareText({
      franchiseName: franchise.name,
      modeName: mode.name,
      filters: describeFilters(active, franchise.series, franchise.seriesLabels),
      won: report.won,
      attempts: report.attempts,
      score: report.score,
      // Las marcas de acierto, parcial y error, con los emojis del tema de la franquicia.
      grid: gridKind === 'marks' ? themeGrid(report.grid, skin.shareEmojis) : report.grid,
      url: buildShareUrl(window.location.href, filterKey),
    });
  }, [report, franchise, mode.name, active, filterKey, gridKind, skin.shareEmojis]);

  const closeDialog = () => setDialog(null);
  const actionsId = useId();
  const [menuSelection, setMenuSelection] = useState(0);
  const actionsRef = useRef<HTMLDivElement>(null);
  const openDialog = (next: Dialog) => { actionsRef.current?.hidePopover(); setDialog(next); };

  return (
    <ActiveAttemptLimit.Provider value={limit}>
    <div className={styles.root} data-game="shell">
      {document.getElementById('game-actions') && createPortal(
        <div className={styles.floatingActions}>
          <button type="button" popoverTarget={actionsId} aria-label={es.shell.actions} className={styles.menuTrigger}>
            <svg className={styles.menuSymbol} viewBox="0 0 24 24" aria-hidden="true" shapeRendering="crispEdges">
              <path d="M5 5h14v3H5zm0 6h14v3H5zm0 6h14v3H5z" fill="currentColor" />
            </svg>
          </button>
          <div id={actionsId} popover="auto" ref={actionsRef} className={styles.actionsMenu}>
          <div className={styles.buttons} role="group" aria-label={es.shell.actions} onKeyDown={(event) => {
            const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')];
            const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
            const next = event.key === 'ArrowDown' ? (current + 1) % buttons.length : event.key === 'ArrowUp' ? (current + buttons.length - 1) % buttons.length : event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : null;
            if (next === null) return;
            event.preventDefault(); buttons[next].focus();
          }}>
            {(['help', 'stats', 'settings'] as const).map((action, index) => <button
              type="button" key={action} className={styles.menuOption} data-selected={menuSelection === index}
              onFocus={() => setMenuSelection(index)}
              onPointerEnter={(event) => { if (event.pointerType === 'mouse' && window.matchMedia('(hover: hover)').matches) setMenuSelection(index); }}
              onClick={() => openDialog(action)}>
              <svg className={styles.optionIcon} viewBox="0 0 24 24" aria-hidden="true" shapeRendering="crispEdges">
                {action === 'help' ? <>
                  <path d="M3 3h8l1 2 1-2h8v18h-8l-1 1-1-1H3z" fill="var(--game-menu-icon-edge, currentColor)" />
                  <path d="M5 5h5v14H5zm9 0h5v14h-5z" fill="var(--game-menu-icon-fill, currentColor)" />
                  <path d="M6 7h3v1H6zm0 4h3v1H6zm9-4h3v1h-3zm0 4h3v1h-3z" fill="var(--surface-panel)" />
                </> : action === 'stats' ? <>
                  <path d="M3 3h18v19H3z" fill="var(--game-menu-icon-edge, currentColor)" />
                  <path d="M5 5h14v15H5z" fill="var(--surface-panel)" />
                  <path d="M6 13h3v5H6zm5-4h3v9h-3zm5-3h2v12h-2z" fill="var(--game-menu-icon-fill, currentColor)" />
                </> : <>
                  <path d="M3 3h18v19H3z" fill="var(--game-menu-icon-edge, currentColor)" />
                  <path d="M5 5h14v15H5z" fill="var(--surface-panel)" />
                  <path d="M6 7h12v2H6zm0 5h12v2H6zm0 5h12v2H6z" fill="var(--game-menu-icon-edge, currentColor)" />
                  <path d="M8 6h3v4H8zm6 5h3v4h-3zm-6 5h3v4H8z" fill="var(--game-menu-icon-fill, currentColor)" />
                </>}
              </svg>
              <span>{action === 'help' ? es.shell.help : action === 'stats' ? es.shell.stats : es.settings.button}</span>
            </button>)}
          </div>
          </div></div>
        , document.getElementById('game-actions')!
      )}
      <ModeNav franchise={franchise.slug} modes={modes} current={mode.slug} solved={solved} filterKey={filterKey} />

      <div className={styles.toolbar}>
        <Countdown />
      </div>

      <FilterPanel
        series={franchise.series}
        labels={franchise.seriesLabels}
        details={franchise.seriesDetails}
        active={active}
        onChange={setActive}
        remaining={remaining}
        minimum={minimumPool}
        toggles={flags.toggles}
      >
        <CopyLinkButton filterKey={filterKey} />
      </FilterPanel>

      {practicing && (
        <div className={styles.practiceBanner} role="status">
          <p>
            <strong>{es.shell.practice.title}</strong> · {es.shell.practice.banner}
          </p>
          <Button variant="ghost" onClick={leavePractice}>
            {es.shell.practice.back}
          </Button>
        </div>
      )}

      {playable && beforeGame?.({ remaining, day: playDay })}

      {/* Otra combinación de filtros, de día o de variante es otra partida: el juego se vuelve a montar. */}
      {playable && (
        <div key={`${sessionKey}:try-${limit ?? ''}`} ref={gameRef} className={styles.game} data-game-mode={mode.slug}>
          {children({
            attemptLimit: limit,
            practice: practicing,
            franchise: franchise.slug,
            mode: mode.slug,
            day: playDay,
            filterKey: variant ? `${filterKey}~${variant}` : filterKey,
            active,
            onFinish: handleFinish,
          })}
        </div>
      )}

      {yesterdayAnswer && !practicing && (
        <section className={styles.yesterday} aria-label={es.shell.yesterday}>
          {yesterdayAnswer.imageStem && (
            <ContentImage className={styles.yesterdayImage} stem={yesterdayAnswer.imageStem} alt="" sizes="3rem" />
          )}
          <p>
            <span className={styles.yesterdayLabel}>{es.shell.yesterday}</span>{' '}
            <strong>{yesterdayAnswer.label}</strong>
          </p>
          <InfoTip compact text={es.help.yesterday} label={es.help.button(es.shell.yesterday)} className={styles.yesterdayHelp} />
        </section>
      )}

      {/* El resultado va al final, debajo de los intentos y de "Ayer fue…", con los modos para seguir jugando. */}
      {report && (
        <div ref={resultRef} className={styles.result}>
          <ResultPanel
            titleOverride={report.title}
            answerIsSentence={report.answerIsSentence}
            won={report.won}
            attempts={report.attempts}
            score={report.score}
            answer={report.answer}
            streak={activeStreak(stats, day)}
            getShareText={getShareText}
            practice={practicing}
            actions={
              practicing ? (
                <>
                  <Button variant="primary" onClick={startPractice}>
                    {es.shell.practice.next}
                  </Button>
                  <Button variant="ghost" onClick={leavePractice}>
                    {es.shell.practice.back}
                  </Button>
                </>
              ) : (
                <CopyLinkButton filterKey={filterKey} />
              )
            }
            leadingAction={
              practicing ? undefined : (
                <Button variant="primary" onClick={startPractice}>
                  {es.shell.practice.start}
                </Button>
              )
            }
          />
          <section className={styles.next} aria-labelledby="next-modes-title">
            <h2 className={styles.nextTitle} id="next-modes-title">
              {es.shell.nextModes}
            </h2>
            <ModeNav
              franchise={franchise.slug}
              modes={modes}
              current={mode.slug}
              solved={solved}
              filterKey={filterKey}
              label={es.shell.nextModesLabel}
            />
          </section>
          {/* Un recuadro aparte, del estilo de los cuadros de diálogo (como el aviso legal), para que no se pierda. */}
          {!practicing && (
            <Panel as="section" variant="dialog" className={styles.practiceBox} aria-labelledby="practice-title">
              <h2 className={styles.practiceTitle} id="practice-title">
                {es.shell.practice.title}
              </h2>
              <p className={styles.practiceText}>{es.shell.practice.intro}</p>
              <div>
                <Button variant="primary" onClick={startPractice}>
                  {es.shell.practice.start}
                </Button>
              </div>
            </Panel>
          )}
        </div>
      )}

      {dialog === 'help' && (
        <Modal title={es.shell.helpTitle(mode.name)} onClose={closeDialog}>
          <div className={styles.help}>
            {es.modeHelp[franchise.slug]?.[mode.slug] && <p>{es.modeHelp[franchise.slug][mode.slug]}</p>}
            {help}
            <p>{es.shell.limits.help}</p>
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

      {dialog === 'settings' && (
        <Modal title={es.settings.title} onClose={closeDialog}>
          <div className={styles.settings}>
            <fieldset className={styles.textSizes}>
              <legend>{es.settings.textSize}</legend>
              <p>{es.settings.textSizeHint}</p>
              <div className={styles.buttons}>{([1, 2, 3] as const).map((textScale) => <Button key={textScale} className={styles.sizeChoice} variant="ghost" aria-pressed={(prefs.textScale ?? 1) === textScale} onClick={() => setPrefs({ ...prefs, textScale })}>{es.settings.scale(textScale)}</Button>)}</div>
            </fieldset>
            <Switch
              label={es.settings.legibleFont}
              hint={es.settings.legibleFontHint}
              checked={prefs.legibleFont}
              onChange={(legibleFont) => setPrefs({ ...prefs, legibleFont })}
            />
            <Switch
              label={es.settings.sounds}
              hint={es.settings.soundsHint}
              checked={prefs.sounds}
              onChange={(sounds) => setPrefs({ ...prefs, sounds })}
            />
          </div>
        </Modal>
      )}

      {dialog === 'stats' && (
        <Modal title={es.shell.statsView.title} onClose={closeDialog}>
          <StatsView
            stats={stats}
            streak={activeStreak(stats, day)}
            latestWin={report?.won && !practicing ? (report.score ?? report.attempts) : undefined}
            kind={resultKind}
          />
        </Modal>
      )}
    </div>
    </ActiveAttemptLimit.Provider>
  );
}
