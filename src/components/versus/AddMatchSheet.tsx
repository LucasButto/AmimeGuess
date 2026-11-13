'use client';

import { useEffect, useMemo, useState } from 'react';
import { modeStatus } from '@/app/[franchise]/[mode]/playable';
import { FilterPanel, PoolNounContext } from '@/components/FilterPanel';
import type { GameToggle } from '@/components/game-shell/flags';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { hasMinimumPool, normalizeActiveSeries } from '@/engine/filters';
import { STORAGE_PREFIX, getLocalStorage, readFilters } from '@/engine/storage';
import { franchises } from '@/franchises';
import { withoutFlagged, type FranchiseData } from '@/franchises/data';
import { minimumPoolOf, modePoolNoun, modePoolSize } from '@/franchises/pool';
import type { FranchiseConfig, ModeConfig } from '@/franchises/types';
import { es } from '@/i18n/es';
import { levelsOf } from '@/modes/timeline/logic';
import { LIMITS } from '@/versus/config';
import { dataOf } from './catalog';
import { variantsOf } from './describe';
import { newBlock, type Block } from './draft';
import { NumberField } from './NumberField';
import styles from './AddMatchSheet.module.scss';

const copy = es.versus.create.sheet;

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
}

/**
 * La hoja "Agregar partida": franquicia → modo → variante (si el modo tiene) → filtros de esa franquicia (los chips de series y,
 * en Dragon Ball, sus interruptores; arrancan con los guardados) → cuántas veces. Un modo sin pool suficiente con esos filtros
 * no se puede agregar, con el mismo aviso que el panel de filtros del juego.
 */
export function AddMatchSheet({ open, onClose, remaining, nextId, onAdd }: AddMatchSheetProps) {
  const [slug, setSlug] = useState(franchises[0]?.slug ?? '');
  const franchise = franchises.find((candidate) => candidate.slug === slug);
  const [loaded, setLoaded] = useState<{ slug: string; data: FranchiseData | 'error' } | null>(null);
  const data = loaded?.slug === slug ? loaded.data : null;
  const [modeSlug, setModeSlug] = useState<string | null>(null);
  const [choice, setChoice] = useState(0);
  const [regional, setRegional] = useState(false);
  const [mega, setMega] = useState(false);
  const [active, setActive] = useState<string[]>(() => (franchise ? startingSeries(franchise) : []));
  const [filler, setFiller] = useState(() => (franchise ? storedFlag('filler', franchise.slug) : true));
  const [manga, setManga] = useState(() => (franchise ? storedFlag('manga', franchise.slug) : true));
  const [count, setCount] = useState(1);

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
  const repeats = Math.min(count, maxCount);

  function variantId(): string | undefined {
    if (!variants) return undefined;
    if (mode?.engine === 'stat-builder') return choice === 1 && !regional && !mega ? undefined : `d${choice}-r${Number(regional)}-m${Number(mega)}`;
    return variants.options[choice]?.id;
  }

  function add() {
    if (!franchise || !mode || !enough || remaining <= 0) return;
    const toggleValues: Record<string, boolean> = {};
    if (toggles.some((toggle) => toggle.id === 'filler') && !filler) toggleValues.filler = false;
    if (toggles.some((toggle) => toggle.id === 'manga') && !manga) toggleValues.manga = false;
    const variant = variantId();
    onAdd(newBlock({ id: nextId(), franchise: franchise.slug, mode: mode.slug, engine: mode.engine, ...(variant === undefined ? {} : { variant }), series: active, toggles: toggleValues, secondsPerExtraSeries: franchise.versusSecondsPerExtraSeries, count: repeats }));
    onClose();
  }

  const footer = (
    <>
      <Button variant="ghost" onClick={onClose}>{copy.cancel}</Button>
      <Button variant="primary" disabled={!enough || remaining <= 0} onClick={add}>{repeats > 1 ? copy.addMany(repeats) : copy.add}</Button>
    </>
  );

  return (
    <Sheet open={open} title={copy.title} onClose={onClose} footer={footer}>
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
            <div className={styles.chips} role="group" aria-labelledby="vs-mode">
              {playable.map((candidate) => (
                <Chip key={candidate.slug} pressed={candidate.slug === modeSlug} onClick={() => pickMode(candidate)}>{candidate.name}</Chip>
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

        {mode && (
          <section className={styles.section} aria-label={copy.repeats}>
            <NumberField label={copy.repeats} value={repeats} min={1} max={Math.min(maxCount, LIMITS.partidas.max)} onChange={setCount} hint={copy.repeatsHint(maxCount)} />
          </section>
        )}
      </div>
    </Sheet>
  );
}
