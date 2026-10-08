'use client';

import { useCallback, useMemo } from 'react';
import { GameShell } from '@/components/game-shell/GameShell';
import type { AnswerInfo, GameSession, ModeLink, ShellFranchise } from '@/components/game-shell/types';
import { defaultMinPool } from '@/engine/filters';
import type { Entity } from '@/engine/types';
import { es } from '@/i18n/es';
import { HigherLowerBoard } from './HigherLowerBoard';
import { HigherLowerHelp } from './HigherLowerHelp';
import { buildRounds, metricOfDay, poolOf } from './logic';
import type { HigherLowerConfig } from './types';

interface HigherLowerGameProps {
  franchise: ShellFranchise;
  mode: { slug: string; name: string };
  /** Todos los modos de la franquicia, para la navegación del marco. */
  modes: readonly ModeLink[];
  config: HigherLowerConfig;
  entities: readonly Entity[];
}

const MINIMUM_POOL = defaultMinPool('higher-lower');

/** Este modo no tiene "Ayer fue…": no hay una respuesta del día, sino una secuencia. */
const noYesterday = (): AnswerInfo | null => null;

/**
 * Modos de comparar de a pares: elegir cuál de los dos tiene el valor mayor,
 * hasta el primer error. Es el motor `higher-lower` montado sobre el marco común
 * (`GameShell`) con resultado de puntaje: acá solo está lo que es propio de él,
 * que es cómo se arma el pool, la ayuda y el juego. No sabe de qué franquicia es
 * ni qué compara: lo dice la configuración (ver `HigherLowerConfig`).
 */
export function HigherLowerGame({ franchise, mode, modes, config, entities }: HigherLowerGameProps) {
  const poolSize = useCallback(
    (active: readonly string[]) => poolOf(entities, active, config.metrics).length,
    [entities, config.metrics],
  );

  return (
    <GameShell
      franchise={franchise}
      mode={mode}
      modes={modes}
      resultKind="score"
      minimumPool={MINIMUM_POOL}
      poolSize={poolSize}
      yesterday={noYesterday}
      help={<HigherLowerHelp config={config} />}
    >
      {(session) => <HigherLowerSession session={session} config={config} entities={entities} />}
    </GameShell>
  );
}

interface HigherLowerSessionProps {
  session: GameSession;
  config: HigherLowerConfig;
  entities: readonly Entity[];
}

/** El juego de una combinación de series: arma el pool y la secuencia de pares una vez por combinación. */
function HigherLowerSession({ session, config, entities }: HigherLowerSessionProps) {
  const { franchise, mode, filterKey, day, active } = session;
  const metric = useMemo(() => metricOfDay(config.metrics, day), [config.metrics, day]);
  const pool = useMemo(() => poolOf(entities, active, config.metrics), [entities, active, config.metrics]);
  const rounds = useMemo(
    () => buildRounds(pool, metric.key, { franchise, mode, filterKey, day }),
    [pool, metric.key, franchise, mode, filterKey, day],
  );

  if (rounds.length === 0) return <p role="status">{es.higherLower.noRounds}</p>;
  return <HigherLowerBoard session={session} metric={metric} rounds={rounds} />;
}
