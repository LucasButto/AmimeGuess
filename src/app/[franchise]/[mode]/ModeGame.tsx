'use client';

import { useEffect, useState } from 'react';
import { hasFranchiseData, loadFranchiseData, type FranchiseData } from '@/franchises/data';
import type { FranchiseConfig, ModeConfig } from '@/franchises/types';
import { es } from '@/i18n/es';
import { ClassicGame } from '@/modes/classic/ClassicGame';
import styles from './ModeGame.module.scss';

interface ModeGameProps {
  franchise: FranchiseConfig;
  mode: ModeConfig;
}

/**
 * Despacha el modo al motor que indica su config. Los motores que todavía no
 * existen, y las franquicias que aún no tienen datos, muestran "Próximamente".
 *
 * Los datos se cargan con import dinámico recién en el cliente. Por eso los
 * motores solo se montan después de la hidratación y pueden leer `window`,
 * `localStorage` y la hora sin producir diferencias con el HTML del servidor.
 */
export function ModeGame({ franchise, mode }: ModeGameProps) {
  const classic = mode.engine === 'classic' ? mode.classic : undefined;
  const playable = classic !== undefined && hasFranchiseData(franchise.slug);
  const [loaded, setLoaded] = useState<FranchiseData | 'error' | null>(null);

  useEffect(() => {
    if (!playable) return;
    let cancelled = false;
    loadFranchiseData(franchise.slug)
      .then((data) => {
        if (!cancelled) setLoaded(data ?? 'error');
      })
      .catch(() => {
        if (!cancelled) setLoaded('error');
      });
    return () => {
      cancelled = true;
    };
  }, [playable, franchise.slug]);

  if (!playable) {
    return (
      <section className={styles.soon}>
        <h2 className={styles.soonTitle}>{es.mode.comingSoon}</h2>
        <p>{es.mode.provisional}</p>
      </section>
    );
  }
  if (loaded === 'error') return <p role="alert">{es.game.loadError}</p>;
  if (loaded === null) return <p role="status">{es.game.loading}</p>;

  return (
    <ClassicGame
      franchise={franchise.slug}
      mode={mode.slug}
      series={franchise.series}
      seriesLabels={franchise.seriesLabels}
      config={classic}
      entities={loaded.entities}
      contents={loaded.contents}
    />
  );
}
