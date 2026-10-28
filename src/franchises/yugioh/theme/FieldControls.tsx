'use client';

import { useEffect, useState } from 'react';
import { FilterPanel, PoolNounContext } from '@/components/FilterPanel';
import { Modal } from '@/components/Modal';
import { useSeriesFilters } from '@/components/useSeriesFilters';
import { yesterday } from '@/engine/daily';
import { getDay, msUntilNextDay } from '@/engine/day';
import { defaultMinPool, eligibleEntities, hasMinimumPool } from '@/engine/filters';
import type { Entity } from '@/engine/types';
import { es } from '@/i18n/es';
import { yugiohConfig } from '../config';
import styles from './FieldControls.module.scss';
import { TempleGlyph } from './TempleGlyph';

/** DailyReward se monta después de hidratar: useSeriesFilters puede leer window con seguridad. */
export function FieldControls() {
  const { active, filterKey, setActive } = useSeriesFilters(yugiohConfig.slug, yugiohConfig.series);
  const [dialog, setDialog] = useState<'graveyard' | 'field' | null>(null);
  const [day, setDay] = useState(() => getDay(new Date()));
  const [entities, setEntities] = useState<readonly Entity[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    // Solo se pide este chunk al montar los controles en la ruta de Yu-Gi-Oh.
    void import('../../../../data/yugioh/entities.json').then((data) => {
      if (!cancelled) setEntities(data.default as Entity[]);
    });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    const refresh = () => setDay(getDay(new Date()));
    const timer = setTimeout(refresh, msUntilNextDay(new Date()) + 250);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [day]);

  // Exactamente el pool y el mínimo de ClassicGame; Duelista no tiene variantes de partida.
  const pool = entities === null ? [] : eligibleEntities(entities, active);
  const minimum = defaultMinPool('classic');
  const answer = hasMinimumPool(pool.length, minimum)
    ? yesterday(pool, { franchise: yugiohConfig.slug, mode: 'duelista', filterKey, day })
    : null;

  return (
    <>
      <div className={styles.controls} data-field-controls="true" role="group" aria-label={es.yugiohSkin.fieldControls}>
        <button type="button" className={styles.control} data-field-control="graveyard" aria-haspopup="dialog" onClick={() => setDialog('graveyard')}>
          <span className={styles.glyph}><TempleGlyph kind="ankh" /></span>
          <span><strong>{es.yugiohSkin.graveyard}</strong><span>{es.yugiohSkin.yesterdayMode}</span></span>
        </button>
        <button type="button" className={styles.control} data-field-control="field" aria-haspopup="dialog" onClick={() => setDialog('field')}>
          <span className={styles.glyph}><TempleGlyph kind="eye" /></span>
          <span><strong>{es.yugiohSkin.field}</strong><span aria-live="polite">{es.yugiohSkin.activeSeries(active.length)}</span></span>
        </button>
      </div>
      {dialog === 'graveyard' && (
        <Modal title={es.yugiohSkin.graveyard} onClose={() => setDialog(null)}>
          <p className={styles.mode}>{es.yugiohSkin.yesterdayMode}</p>
          <p className={styles.answer} data-graveyard-answer={answer?.id} aria-live="polite">
            {entities === null ? es.yugiohSkin.loadingData : answer ? <>{es.shell.yesterday} <strong>{answer.name.es}</strong></> : es.yugiohSkin.noYesterday}
          </p>
        </Modal>
      )}
      {dialog === 'field' && (
        <Modal title={es.yugiohSkin.field} onClose={() => setDialog(null)}>
          <PoolNounContext value={yugiohConfig.entityNoun}>
            {entities === null ? <p role="status">{es.yugiohSkin.loadingData}</p> : (
              <FilterPanel series={yugiohConfig.series} labels={yugiohConfig.seriesLabels} active={active}
                onChange={setActive} remaining={pool.length} minimum={minimum} />
            )}
          </PoolNounContext>
        </Modal>
      )}
    </>
  );
}
