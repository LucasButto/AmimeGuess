'use client';

import { useEffect, useState } from 'react';
import { ModeNav } from '@/components/game-shell/ModeNav';
import type { ModeLink } from '@/components/game-shell/types';
import { entitiesOfMode, loadFranchiseData, type FranchiseData } from '@/franchises/data';
import type { FranchiseConfig, ModeConfig } from '@/franchises/types';
import { es } from '@/i18n/es';
import { ClassicGame } from '@/modes/classic/ClassicGame';
import { ConnectionsGame } from '@/modes/connections/ConnectionsGame';
import { HigherLowerGame } from '@/modes/higher-lower/HigherLowerGame';
import { ImageRevealGame } from '@/modes/image-reveal/ImageRevealGame';
import { RevealListGame } from '@/modes/reveal-list/RevealListGame';
import { TextClueGame } from '@/modes/text-clue/TextClueGame';
import { TimelineGame } from '@/modes/timeline/TimelineGame';
import styles from './ModeGame.module.scss';

interface ModeGameProps {
  franchise: FranchiseConfig;
  mode: ModeConfig;
  /** Todos los modos de la franquicia con su disponibilidad, para la navegación. */
  modes: readonly ModeLink[];
  /** `false` si el modo todavía no existe o no tiene contenido suficiente: muestra "Próximamente". Lo decide la página con los datos. */
  playable: boolean;
}

/**
 * Despacha el modo al motor que indica su config. Los motores que todavía no
 * existen, las franquicias que aún no tienen datos y los modos sin contenido
 * suficiente muestran "Próximamente".
 *
 * Los datos se cargan con import dinámico recién en el cliente. Por eso los
 * motores solo se montan después de la hidratación y pueden leer `window`,
 * `localStorage` y la hora sin producir diferencias con el HTML del servidor.
 */
export function ModeGame({ franchise, mode, modes, playable }: ModeGameProps) {
  const classic = mode.engine === 'classic' ? mode.classic : undefined;
  const imageReveal = mode.engine === 'image-reveal' ? mode.imageReveal : undefined;
  const textClue = mode.engine === 'text-clue' ? mode.textClue : undefined;
  const revealList = mode.engine === 'reveal-list' ? mode.revealList : undefined;
  const higherLower = mode.engine === 'higher-lower' ? mode.higherLower : undefined;
  const timeline = mode.engine === 'timeline' ? mode.timeline : undefined;
  const connections = mode.engine === 'connections' ? mode.connections : undefined;
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

  const comingSoon = (
    <div className={styles.soonPage}>
      <ModeNav franchise={franchise.slug} modes={modes} current={mode.slug} />
      <section className={styles.soon}>
        <h2 className={styles.soonTitle}>{es.mode.comingSoon}</h2>
        <p>{es.mode.provisional}</p>
      </section>
    </div>
  );

  if (!playable) return comingSoon;
  if (loaded === 'error') return <p role="alert">{es.game.loadError}</p>;
  if (loaded === null) return <p role="status">{es.game.loading}</p>;

  // Las entidades que se adivinan: las de un conjunto con nombre (las formas de Dragon Ball) o las principales.
  const entities = entitiesOfMode(loaded, mode.entitySet);

  if (imageReveal) {
    return (
      <ImageRevealGame
        franchise={franchise}
        mode={mode}
        modes={modes}
        config={imageReveal}
        entities={entities}
        contents={loaded.contents}
      />
    );
  }

  if (revealList) {
    return (
      <RevealListGame
        franchise={franchise}
        mode={mode}
        modes={modes}
        config={revealList}
        entities={entities}
        contents={loaded.contents}
      />
    );
  }

  if (higherLower) {
    return (
      <HigherLowerGame
        franchise={franchise}
        mode={mode}
        modes={modes}
        config={higherLower}
        entities={entities}
      />
    );
  }

  if (timeline) {
    return <TimelineGame franchise={franchise} mode={mode} modes={modes} config={timeline} contents={loaded.contents} />;
  }

  if (connections) {
    return (
      <ConnectionsGame
        franchise={franchise}
        mode={mode}
        modes={modes}
        config={connections}
        entities={entities}
        contents={loaded.contents}
      />
    );
  }

  if (textClue) {
    return (
      <TextClueGame
        franchise={franchise}
        mode={mode}
        modes={modes}
        config={textClue}
        entities={entities}
        contents={loaded.contents}
      />
    );
  }

  if (classic) {
    return (
      <ClassicGame
        franchise={franchise}
        mode={mode}
        modes={modes}
        config={classic}
        entities={entities}
        contents={loaded.contents}
      />
    );
  }

  return comingSoon;
}
