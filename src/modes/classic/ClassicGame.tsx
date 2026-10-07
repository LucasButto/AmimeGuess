'use client';

import { useMemo, useState } from 'react';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import { FilterPanel } from '@/components/FilterPanel';
import { useSeriesFilters } from '@/components/useSeriesFilters';
import { getDay } from '@/engine/day';
import { defaultMinPool, eligibleEntities, hasMinimumPool } from '@/engine/filters';
import type { Content, Entity } from '@/engine/types';
import { ClassicBoard } from './ClassicBoard';
import styles from './ClassicGame.module.scss';
import { visibleColumns } from './logic';
import type { ClassicConfig } from './types';

interface ClassicGameProps {
  franchise: string;
  mode: string;
  /** Ids de serie en orden canónico. */
  series: readonly string[];
  seriesLabels: Readonly<Record<string, string>>;
  config: ClassicConfig;
  entities: readonly Entity[];
  contents: readonly Content[];
}

/**
 * Modo Clásico: se adivina una entidad por la tabla de atributos de sus
 * intentos. Es genérico: las columnas, las pistas y los datos vienen por
 * props, y no sabe de qué franquicia son.
 *
 * El reto se calcula en el cliente, después del montaje (SPEC 8), así que este
 * componente solo se monta cuando los datos ya cargaron (ver `ModeGame`).
 */
export function ClassicGame({ franchise, mode, series, seriesLabels, config, entities, contents }: ClassicGameProps) {
  const { active, filterKey, setActive } = useSeriesFilters(franchise, series);
  const [day] = useState(() => getDay(new Date()));

  const pool = useMemo(() => eligibleEntities(entities, active), [entities, active]);
  const columns = useMemo(() => visibleColumns(config.columns, active), [config.columns, active]);
  const minimum = defaultMinPool('classic');

  return (
    <div className={styles.root} data-game="classic">
      <FilterPanel
        series={series}
        labels={seriesLabels}
        active={active}
        onChange={setActive}
        remaining={pool.length}
        minimum={minimum}
      >
        <CopyLinkButton filterKey={filterKey} />
      </FilterPanel>

      {hasMinimumPool(pool.length, minimum) && (
        <ClassicBoard
          // Otra combinación de filtros o de día es otra partida: se vuelve a montar.
          key={`${filterKey}:${day}`}
          franchise={franchise}
          mode={mode}
          filterKey={filterKey}
          day={day}
          pool={pool}
          active={active}
          columns={columns}
          hints={config.hints}
          contents={contents}
        />
      )}
    </div>
  );
}
