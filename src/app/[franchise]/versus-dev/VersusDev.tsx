'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BackNav } from '@/components/BackNav';
import { TitleWords } from '@/components/TitleWords';
import { GAME_DOCK_ID } from '@/components/game-shell/dockId';
import type { FinishReport, ModeLink, VersusProgress } from '@/components/game-shell/types';
import { Button } from '@/components/ui/Button';
import { VersusGameContext, type VersusGame } from '@/components/versus/VersusGameContext';
import type { FranchiseConfig, ModeConfig } from '@/franchises/types';
import { es } from '@/i18n/es';
import { DEFAULT_OPTIONS, MODALITIES, defaultTimeLimit, type Modality, type Partida } from '@/versus/config';
import { ModeGame } from '../[mode]/ModeGame';
import pageStyles from '../[mode]/page.module.scss';
import styles from './VersusDev.module.scss';

interface Props {
  franchise: FranchiseConfig;
  playable: readonly ModeConfig[];
  modes: readonly ModeLink[];
  appShell: boolean;
  /** Los parámetros de la URL (`?mode=clasico&modality=race&limit=90&seed=x&index=2`), para capturas repetibles. */
  query: Readonly<Record<string, string | undefined>>;
}

/** Lo que la sala falsa recibió, para verlo en pantalla. */
type LogEntry = { readonly kind: 'progress'; readonly value: VersusProgress } | { readonly kind: 'finish'; readonly value: FinishReport } | { readonly kind: 'loaded' };

/** La configuración inicial, de los parámetros de la URL. */
function fromQuery(playable: readonly ModeConfig[], query: Props['query']) {
  const mode = playable.find((candidate) => candidate.slug === query.mode)?.slug ?? playable[0]?.slug ?? '';
  const modality = (MODALITIES as readonly string[]).includes(query.modality ?? '') ? (query.modality as Modality) : 'timeAttack';
  const limit = Number(query.limit);
  return {
    mode,
    modality,
    limitSeconds: Number.isInteger(limit) && limit >= 10 ? limit : null,
    seed: query.seed ?? 'dev',
    index: Math.max(1, Number(query.index) || 1),
  };
}

/**
 * La partida de versus falsa de la página de desarrollo: elige modo y modalidad, simula el tiempo límite con un
 * temporizador local y muestra lo que el juego le avisa a la sala (progreso, final, pista cargada).
 */
export function VersusDev({ franchise, playable, modes, appShell, query }: Props) {
  const [initial] = useState(() => fromQuery(playable, query));
  const [modeSlug, setModeSlug] = useState(initial.mode);
  const [modality, setModality] = useState<Modality>(initial.modality);
  const mode = playable.find((candidate) => candidate.slug === modeSlug) ?? playable[0];
  const defaultSeconds = mode ? defaultTimeLimit(mode.engine, franchise.series.length, franchise.versusSecondsPerExtraSeries) / 1000 : 60;
  const [limitSeconds, setLimitSeconds] = useState<number | null>(initial.limitSeconds);
  const seconds = limitSeconds ?? defaultSeconds;
  // Cada "Empezar partida" es otra partida: otro índice, otro reto y otro reloj.
  const [round, setRound] = useState(() => ({ index: initial.index, startedAt: Date.now() }));
  const [stop, setStop] = useState<'won' | 'timeUp' | undefined>(undefined);
  const [finished, setFinished] = useState(false);
  const [log, setLog] = useState<readonly LogEntry[]>([]);

  const start = useCallback(() => {
    setRound((current) => ({ index: current.index + 1, startedAt: Date.now() }));
    setStop(undefined);
    setFinished(false);
    setLog([]);
  }, []);

  const partida = useMemo<Partida | null>(
    () =>
      mode
        ? {
            franchise: franchise.slug,
            mode: mode.slug,
            engine: mode.engine,
            series: [...franchise.series],
            ...(modality === 'timeAttack' ? { timeLimitMs: seconds * 1000 } : {}),
          }
        : null,
    [mode, franchise.slug, franchise.series, modality, seconds],
  );
  const endsAt = modality === 'timeAttack' ? round.startedAt + seconds * 1000 : undefined;

  // El tiempo límite, simulado acá (en la sala real lo manda el servidor).
  useEffect(() => {
    if (endsAt === undefined || stop || finished) return;
    const timer = window.setTimeout(() => setStop('timeUp'), Math.max(0, endsAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [endsAt, stop, finished]);

  const game = useMemo<VersusGame | null>(
    () =>
      partida && {
        seed: initial.seed,
        index: round.index,
        total: 3,
        modality,
        partida,
        options: DEFAULT_OPTIONS,
        startedAt: round.startedAt,
        raceStartedAt: round.startedAt,
        endsAt,
        stop,
        onProgress: (value) => setLog((entries) => [...entries, { kind: 'progress', value }]),
        onFinish: (value) => {
          setFinished(true);
          setLog((entries) => [...entries, { kind: 'finish', value }]);
        },
        onLoaded: () => setLog((entries) => [...entries, { kind: 'loaded' }]),
        onNext: start,
      },
    [partida, initial.seed, round, modality, endsAt, stop, start],
  );

  if (!mode || !game) return null;

  const controls = (
    <details className={styles.controls} data-versus-dev="">
      <summary>{es.versus.dev.title}</summary>
      <p className={styles.intro}>{es.versus.dev.intro}</p>
      <div className={styles.fields}>
        <label className={styles.field}>
          <span>{es.versus.dev.mode}</span>
          <select value={mode.slug} onChange={(event) => { setModeSlug(event.target.value); setLimitSeconds(null); start(); }}>
            {playable.map((candidate) => <option key={candidate.slug} value={candidate.slug}>{candidate.name}</option>)}
          </select>
        </label>
        <label className={styles.field}>
          <span>{es.versus.dev.modality}</span>
          <select value={modality} onChange={(event) => { setModality(event.target.value as Modality); start(); }}>
            {MODALITIES.map((id) => <option key={id} value={id}>{es.versus.modality[id]}</option>)}
          </select>
        </label>
        {modality === 'timeAttack' && (
          <label className={styles.field}>
            <span>{es.versus.dev.timeLimit}</span>
            <input type="number" min={10} max={1800} step={5} value={seconds} onChange={(event) => setLimitSeconds(Number(event.target.value))} />
          </label>
        )}
      </div>
      <div className={styles.actions}>
        <Button onClick={start}>{es.versus.dev.start}</Button>
        <Button variant="ghost" disabled={finished || stop !== undefined} onClick={() => setStop('timeUp')}>{es.versus.dev.timeUp}</Button>
        {mode.engine === 'higher-lower' && <Button variant="ghost" disabled={finished || stop !== undefined} onClick={() => setStop('won')}>{es.versus.dev.earlyEnd}</Button>}
      </div>
      <h2 className={styles.logTitle}>{es.versus.dev.log}</h2>
      <ol className={styles.log} data-versus-log="">
        {log.map((entry, index) => (
          <li key={index}>
            {entry.kind === 'loaded' ? 'loaded' : `${entry.kind} ${JSON.stringify(entry.kind === 'finish' ? { won: entry.value.won, attempts: entry.value.attempts, score: entry.value.score, scores: entry.value.scores, timedOut: entry.value.timedOut } : entry.value)}`}
          </li>
        ))}
      </ol>
    </details>
  );

  const heading = (
    <header className={pageStyles.header}>
      <p className={pageStyles.franchise}>{franchise.name}</p>
      <h1 className={pageStyles.title}><TitleWords text={mode.name} /></h1>
    </header>
  );
  const navigation = (
    <div className={pageStyles.topbar}>
      <BackNav franchise={franchise} appShell={appShell} />
      <div id="game-actions" className={pageStyles.actionsSlot} />
    </div>
  );

  return (
    <main className={pageStyles.page} data-shell={appShell ? 'app' : undefined} data-game-screen>
      {appShell ? <div className={pageStyles.appBar}>{navigation}{heading}</div> : <>{navigation}{heading}</>}
      <div className={pageStyles.plate} data-app-content={appShell ? '' : undefined}>
        {controls}
        <VersusGameContext.Provider value={game}>
          <ModeGame key={`${mode.slug}:${modality}:${round.index}`} appShell={appShell} franchise={franchise} mode={mode} modes={modes} playable />
        </VersusGameContext.Provider>
      </div>
      {appShell && <div id={GAME_DOCK_ID} className={pageStyles.dock} data-dock="" />}
    </main>
  );
}
