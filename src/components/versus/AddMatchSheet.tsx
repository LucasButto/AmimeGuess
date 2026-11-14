'use client';

import { useEffect, useMemo, useState } from 'react';
import { modeStatus } from '@/app/[franchise]/[mode]/playable';
import { FilterPanel, PoolNounContext } from '@/components/FilterPanel';
import type { GameToggle } from '@/components/game-shell/flags';
import { Sheet } from '@/components/Sheet';
import { ArcadeButton } from './arcade/ArcadeButton';
import { Chip } from '@/components/ui/Chip';
import { hasMinimumPool, normalizeActiveSeries } from '@/engine/filters';
import { STORAGE_PREFIX, getLocalStorage, readFilters } from '@/engine/storage';
import { franchises } from '@/franchises';
import { withoutFlagged, type FranchiseData } from '@/franchises/data';
import { minimumPoolOf, modePoolNoun, modePoolSize } from '@/franchises/pool';
import type { FranchiseConfig, ModeConfig } from '@/franchises/types';
import { es } from '@/i18n/es';
import { levelsOf } from '@/modes/timeline/logic';
import { LIMITS, defaultTimeLimit } from '@/versus/config';
import { dataOf } from './catalog';
import { variantsOf } from './describe';
import { newBlock, parseClock, setBlockTime, type Block } from './draft';
import { formatClock } from './format';
import { ArcadeIcon } from './arcade/ArcadeIcon';
import type { ArcadeIconName } from './arcade/icons';
import { NumberField } from './NumberField';
import styles from './AddMatchSheet.module.scss';

const copy = es.versus.create.sheet;
const createCopy = es.versus.create;

/** La variante de la partida según lo elegido en la hoja (el nivel o la medida; en Estadísticas, además las formas). */
function variantOf(mode: ModeConfig | undefined, variants: ReturnType<typeof variantsOf>, choice: number, regional: boolean, mega: boolean): string | undefined {
  if (!mode || !variants) return undefined;
  if (mode.engine === 'stat-builder') return choice === 1 && !regional && !mega ? undefined : `d${choice}-r${Number(regional)}-m${Number(mega)}`;
  return variants.options[choice]?.id;
}

/** Lo elegido en la hoja a partir de una partida que ya está en la sala (para editarla). */
function startOf(editing: Block | undefined): { choice: number; regional: boolean; mega: boolean } {
  const none = { choice: 0, regional: false, mega: false };
  if (!editing) return none;
  const mode = franchises.find((candidate) => candidate.slug === editing.partida.franchise)?.modes.find((candidate) => candidate.slug === editing.partida.mode);
  const variants = mode ? variantsOf(mode) : null;
  if (!mode || !variants) return none;
  const variant = editing.partida.variant;
  if (mode.engine === 'stat-builder') {
    const match = /^d(\d+)-r([01])-m([01])$/.exec(variant ?? '');
    return match ? { choice: Number(match[1]), regional: match[2] === '1', mega: match[3] === '1' } : { ...none, choice: variants.initial };
  }
  const found = variants.options.findIndex((option) => option.id === variant);
  return { ...none, choice: found >= 0 ? found : variants.initial };
}

/** El ícono de cada tipo de minijuego (por su motor): lupa, silueta, signo de pregunta… */
const ENGINE_ICON: Readonly<Record<string, ArcadeIconName>> = {
  classic: 'search',
  'image-reveal': 'player',
  'text-clue': 'question',
  'reveal-list': 'players',
  'higher-lower': 'sort',
  timeline: 'hourglass',
  connections: 'shuffle',
  'stat-builder': 'gamepad',
  'category-board': 'key-a',
};

/** Con qué series arranca una partida de esta franquicia: las que la persona tiene guardadas (o todas). */
function startingSeries(franchise: FranchiseConfig): string[] {
  const saved = readFilters(getLocalStorage(), franchise.slug);
  const normalized = saved ? normalizeActiveSeries(saved, franchise.series) : [];
  return normalized.length > 0 ? normalized : [...franchise.series];
}

/** Un interruptor guardado de la franquicia (relleno, arcos del manga): "0" lo apaga; sin nada, prendido. */
function storedFlag(name: string, franchise: string): boolean {
  try {
    return getLocalStorage()?.getItem(`${STORAGE_PREFIX}:${name}:${franchise}`) !== '0';
  } catch {
    return true;
  }
}

interface AddMatchSheetProps {
  open: boolean;
  onClose: () => void;
  /** Cuántas partidas más entran en la sala. */
  remaining: number;
  nextId: () => string;
  onAdd: (block: Block) => void;
  /** Desempate ("Otro modo"): una sola partida, sin repeticiones. */
  single?: { title: string; add: string };
  /** Contrarreloj: la hoja deja elegir el tiempo límite de la partida (al lado de cuántas veces). */
  timed?: boolean;
  /** Una partida de la sala para editar: la hoja arranca con sus datos y, al confirmar, la reemplaza (mismo lugar). */
  editing?: Block;
}

/**
 * La hoja "Agregar partida": franquicia → modo → variante (si el modo tiene) → filtros de esa franquicia (los chips de series y,
 * en Dragon Ball, sus interruptores; arrancan con los guardados) → cuántas veces. Un modo sin pool suficiente con esos filtros
 * no se puede agregar, con el mismo aviso que el panel de filtros del juego.
 */
export function AddMatchSheet({ open, onClose, remaining, nextId, onAdd, single, timed = false, editing }: AddMatchSheetProps) {
  const [slug, setSlug] = useState(editing?.partida.franchise ?? franchises[0]?.slug ?? '');
  const start = startOf(editing);
  const franchise = franchises.find((candidate) => candidate.slug === slug);
  const [loaded, setLoaded] = useState<{ slug: string; data: FranchiseData | 'error' } | null>(null);
  const data = loaded?.slug === slug ? loaded.data : null;
  const [modeSlug, setModeSlug] = useState<string | null>(editing?.partida.mode ?? null);
  const [choice, setChoice] = useState(start.choice);
  const [regional, setRegional] = useState(start.regional);
  const [mega, setMega] = useState(start.mega);
  const [active, setActive] = useState<string[]>(() => (editing ? [...editing.partida.series] : franchise ? startingSeries(franchise) : []));
  const [filler, setFiller] = useState(() => (editing ? editing.partida.toggles?.filler !== false : franchise ? storedFlag('filler', franchise.slug) : true));
  const [manga, setManga] = useState(() => (editing ? editing.partida.toggles?.manga !== false : franchise ? storedFlag('manga', franchise.slug) : true));
  const [count, setCount] = useState(1);
  // El tiempo límite elegido a mano (`null`: el sugerido para este modo y estas series).
  const [customTime, setCustomTime] = useState<number | null>(editing?.partida.timeEdited ? editing.partida.timeLimitMs : null);

  useEffect(() => {
    let cancelled = false;
    dataOf(slug)
      .then((result) => {
        if (!cancelled) setLoaded({ slug, data: result ?? 'error' });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ slug, data: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  function pickFranchise(next: FranchiseConfig) {
    setSlug(next.slug);
    setModeSlug(null);
    setChoice(0);
    setRegional(false);
    setMega(false);
    setCustomTime(null);
    setActive(startingSeries(next));
    setFiller(storedFlag('filler', next.slug));
    setManga(storedFlag('manga', next.slug));
  }

  const playable = useMemo(() => (franchise && data && data !== 'error' ? franchise.modes.filter((mode) => modeStatus(franchise, mode, data) === 'playable') : []), [franchise, data]);
  const mode = playable.find((candidate) => candidate.slug === modeSlug);
  const variants = mode ? variantsOf(mode) : null;
  const loadedData = data && data !== 'error' ? data : null;

  function pickMode(next: ModeConfig) {
    setModeSlug(next.slug);
    setCustomTime(null);
    setChoice(variantsOf(next)?.initial ?? 0);
    setRegional(false);
    setMega(false);
  }

  // Cada interruptor aparece solo si en este modo deja afuera alguna respuesta (igual que en la página del modo).
  const toggles = useMemo<GameToggle[]>(() => {
    if (!franchise || !mode || !loadedData) return [];
    const sizeWith = (flags: { skipFiller: boolean; skipMangaOnly: boolean }) => modePoolSize(mode, withoutFlagged(loadedData, flags), franchise.series);
    const base = sizeWith({ skipFiller: false, skipMangaOnly: false });
    const list: GameToggle[] = [];
    if (sizeWith({ skipFiller: true, skipMangaOnly: false }) !== base) list.push({ id: 'filler', label: es.filters.filler, help: es.help.filler, on: filler, onChange: setFiller });
    if (!franchise.hideMangaToggle && sizeWith({ skipFiller: false, skipMangaOnly: true }) !== base) list.push({ id: 'manga', label: es.filters.manga, help: es.help.manga, on: manga, onChange: setManga });
    return list;
  }, [franchise, mode, loadedData, filler, manga]);

  const skipFiller = !filler && toggles.some((toggle) => toggle.id === 'filler');
  const skipManga = franchise?.hideMangaToggle === true || (!manga && toggles.some((toggle) => toggle.id === 'manga'));
  const size = useMemo(() => {
    if (!franchise || !mode || !loadedData) return 0;
    return modePoolSize(mode, withoutFlagged(loadedData, { skipFiller, skipMangaOnly: skipManga }), active) ?? 0;
  }, [franchise, mode, loadedData, skipFiller, skipManga, active]);

  const minimum = mode ? minimumPoolOf(mode) : 0;
  // Línea de tiempo: cada dificultad pide una cantidad de sucesos.
  const levelNeed = mode?.engine === 'timeline' && mode.timeline ? (levelsOf(mode.timeline)[choice]?.count ?? 0) : 0;
  const needed = Math.max(minimum, levelNeed);
  const enough = mode !== undefined && hasMinimumPool(size, needed);
  const hasForms = mode?.engine === 'stat-builder' && (loadedData?.entitySets?.[mode.entitySet ?? '']?.some((entity) => entity.attrs.statForm !== undefined) ?? false);
  const maxCount = Math.max(1, remaining);
  const repeats = single || editing ? 1 : Math.min(count, maxCount);

  // El tiempo sugerido para lo que está elegido (el que llevaría la partida si no se toca el campo).
  const suggestedTime = franchise && mode ? defaultTimeLimit(mode.engine, active.length, franchise.versusSecondsPerExtraSeries) : null;
  const showTime = timed && !single && suggestedTime !== null;

  function add() {
    if (!franchise || !mode || !enough || (remaining <= 0 && !editing)) return;
    const toggleValues: Record<string, boolean> = {};
    if (toggles.some((toggle) => toggle.id === 'filler') && !filler) toggleValues.filler = false;
    if (toggles.some((toggle) => toggle.id === 'manga') && !manga) toggleValues.manga = false;
    const variant = variantOf(mode, variants, choice, regional, mega);
    const block = newBlock({ id: editing?.id ?? nextId(), franchise: franchise.slug, mode: mode.slug, engine: mode.engine, ...(variant === undefined ? {} : { variant }), series: active, toggles: toggleValues, secondsPerExtraSeries: franchise.versusSecondsPerExtraSeries, count: repeats });
    onAdd(timed && !single && customTime !== null ? (setBlockTime([block], block.id, customTime)[0] ?? block) : block);
    onClose();
  }

  const footer = (
    <>
      <ArcadeButton tone="red" onClick={onClose}>{copy.cancel}</ArcadeButton>
      <ArcadeButton tone="gold" icon={editing ? 'check' : 'add-player'} disabled={!enough || (remaining <= 0 && !editing)} onClick={add}>{single ? single.add : editing ? copy.save : repeats > 1 ? copy.addMany(repeats) : copy.add}</ArcadeButton>
    </>
  );

  return (
    <Sheet open={open} title={single?.title ?? (editing ? copy.editTitle : copy.title)} onClose={onClose} footer={footer}>
      <div className={styles.body}>
        <section className={styles.section} aria-labelledby="vs-franchise">
          <h3 className={styles.heading} id="vs-franchise">{copy.franchise}</h3>
          <div className={styles.chips} role="group" aria-labelledby="vs-franchise">
            {franchises.map((candidate) => (
              <Chip key={candidate.slug} pressed={candidate.slug === slug} onClick={() => pickFranchise(candidate)}>{candidate.name}</Chip>
            ))}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="vs-mode">
          <h3 className={styles.heading} id="vs-mode">{copy.mode}</h3>
          {data === null && <p className={styles.note} role="status">{copy.modeLoading}</p>}
          {data === 'error' && <p className={styles.note} role="alert">{copy.modeError}</p>}
          {loadedData && (
            <div className={styles.tiles} role="group" aria-labelledby="vs-mode">
              {playable.map((candidate) => (
                <button key={candidate.slug} type="button" className={styles.tile} aria-pressed={candidate.slug === modeSlug} onClick={() => pickMode(candidate)}>
                  {candidate.versusIcon ? (
                    <img className={styles.modeIcon} src={`/img/versus/modes/${candidate.versusIcon}.png`} alt="" aria-hidden="true" width={128} height={128} draggable={false} decoding="async" />
                  ) : (
                    <ArcadeIcon name={ENGINE_ICON[candidate.engine] ?? 'star'} size="lg" />
                  )}
                  <span>{candidate.name}</span>
                </button>
              ))}
            </div>
          )}
          {loadedData && !mode && <p className={styles.note}>{copy.pickMode}</p>}
        </section>

        {mode && variants && (
          <section className={styles.section} aria-labelledby="vs-variant">
            <h3 className={styles.heading} id="vs-variant">{variants.title}</h3>
            <div className={styles.chips} role="group" aria-labelledby="vs-variant">
              {variants.options.map((option, index) => (
                <Chip key={option.label} pressed={index === choice} onClick={() => setChoice(index)}>{option.label}</Chip>
              ))}
            </div>
            {hasForms && (
              <div className={styles.chips} role="group" aria-label={copy.forms}>
                <Chip pressed={regional} onClick={() => setRegional(!regional)}>{copy.regional}</Chip>
                <Chip pressed={mega} onClick={() => setMega(!mega)}>{copy.mega}</Chip>
              </div>
            )}
          </section>
        )}

        {franchise && mode && loadedData && (
          <section className={styles.section} aria-label={copy.filters}>
            <PoolNounContext.Provider value={modePoolNoun(franchise, mode)}>
              <FilterPanel series={franchise.series} labels={franchise.seriesLabels} details={franchise.seriesDetails} active={active} onChange={setActive} remaining={size} minimum={needed} toggles={toggles} sheet />
            </PoolNounContext.Provider>
            {levelNeed > minimum && size < levelNeed && size >= minimum && <p className={styles.note} role="status">{copy.needLevel(levelNeed, size)}</p>}
          </section>
        )}

        {mode && !single && (
          <section className={styles.section} aria-label={copy.repeats}>
            <div className={styles.pair}>
              {!editing && <NumberField label={copy.repeats} value={repeats} min={1} max={Math.min(maxCount, LIMITS.partidas.max)} onChange={setCount} hint={copy.repeatsHint(maxCount)} />}
              {showTime && (
                <NumberField
                  label={createCopy.time.label}
                  value={customTime ?? suggestedTime}
                  min={LIMITS.timeLimitMs.min}
                  max={LIMITS.timeLimitMs.max}
                  step={LIMITS.timeLimitMs.step}
                  format={formatClock}
                  parse={parseClock}
                  lessLabel={createCopy.time.less}
                  moreLabel={createCopy.time.more}
                  onChange={setCustomTime}
                  hint={createCopy.time.range}
                />
              )}
            </div>
          </section>
        )}
      </div>
    </Sheet>
  );
}
