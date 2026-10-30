'use client';

import { useCallback, useMemo, useState } from 'react';
import { GameShell } from '@/components/game-shell/GameShell';
import type { AnswerInfo, GameSession, ModeLink, ShellFranchise } from '@/components/game-shell/types';
import { defaultMinPool } from '@/engine/filters';
import { STORAGE_PREFIX, getLocalStorage } from '@/engine/storage';
import type { Entity } from '@/engine/types';
import { es } from '@/i18n/es';
import { HigherLowerBoard } from './HigherLowerBoard';
import { HigherLowerHelp } from './HigherLowerHelp';
import { MAX_ROUNDS, buildRounds, endlessRounds, metricOfDay, poolOf } from './logic';
import { MetricPicker } from './MetricPicker';
import type { HigherLowerConfig, HigherLowerMetric } from './types';

interface HigherLowerGameProps {
  franchise: ShellFranchise;
  mode: { slug: string; name: string };
  /** Todos los modos de la franquicia, para la navegación del marco. */
  modes: readonly ModeLink[];
  config: HigherLowerConfig;
  entities: readonly Entity[];
}

const MINIMUM_POOL = defaultMinPool('higher-lower');

/** La medida que se eligió la última vez en este modo, o `null` (la del día). Solo vale si sigue en la configuración. */
function readMetric(franchise: string, mode: string, metrics: readonly HigherLowerMetric[]): string | null {
  try {
    const value = getLocalStorage()?.getItem(`${STORAGE_PREFIX}:metric:${franchise}:${mode}`);
    return value != null && metrics.some((metric) => metric.key === value) ? value : null;
  } catch {
    return null;
  }
}

function saveMetric(franchise: string, mode: string, key: string | null): void {
  try {
    // Sin elección (la del día) se guarda vacío: `StorageLike` no borra claves.
    getLocalStorage()?.setItem(`${STORAGE_PREFIX}:metric:${franchise}:${mode}`, key ?? '');
  } catch {
    // Sin almacenamiento, la elección dura mientras la página siga abierta.
  }
}

/** Este modo no tiene "Ayer fue…": no hay una respuesta del día, sino una secuencia. */
const noYesterday = (): AnswerInfo | null => null;

/**
 * Modos de comparar de a pares: elegir cuál de los dos tiene el valor mayor,
 * hasta el primer error. Es el motor `higher-lower` montado sobre el marco común
 * (`GameShell`) con resultado de puntaje: acá solo está lo que es propio de él,
 * que es cómo se arma el pool, la ayuda y el juego. No sabe de qué franquicia es ni
 * qué compara: lo dice la configuración (ver `HigherLowerConfig`). Con más de una medida,
 * quien juega puede elegir cuál comparar; cada una es otra partida (la variante `m-<medida>`).
 */
export function HigherLowerGame({ franchise, mode, modes, config, entities }: HigherLowerGameProps) {
  const [chosen, setChosen] = useState<string | null>(() => readMetric(franchise.slug, mode.slug, config.metrics));
  const many = config.metrics.length > 1;
  // "Del día" es la de siempre (sin variante); las demás son otras partidas.
  const variant = many && chosen !== null ? `m-${chosen}` : undefined;

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
      variant={variant}
      beforeGame={
        many
          ? ({ day }) => (
              <MetricPicker
                metrics={config.metrics}
                selected={chosen}
                today={metricOfDay(config.metrics, day)}
                onSelect={(key) => {
                  saveMetric(franchise.slug, mode.slug, key);
                  setChosen(key);
                }}
              />
            )
          : undefined
      }
    >
      {(session) => <HigherLowerSession session={session} config={config} entities={entities} chosen={many ? chosen : null} />}
    </GameShell>
  );
}

interface HigherLowerSessionProps {
  session: GameSession;
  config: HigherLowerConfig;
  entities: readonly Entity[];
  /** La medida elegida, o `null` para la del día. */
  chosen: string | null;
}

/** El juego de una combinación de series: arma el pool y la secuencia de pares una vez por combinación. */
function HigherLowerSession({ session, config, entities, chosen }: HigherLowerSessionProps) {
  const { franchise, mode, filterKey, day, active } = session;
  const metric = useMemo(
    () => config.metrics.find((candidate) => candidate.key === chosen) ?? metricOfDay(config.metrics, day),
    [config.metrics, chosen, day],
  );
  const pool = useMemo(() => poolOf(entities, active, config.metrics), [entities, active, config.metrics]);
  const sequence = useMemo(
    () => session.practice ? endlessRounds(pool, metric.key, { franchise, mode, filterKey, day }, config.minRatio) : undefined,
    [session.practice, pool, metric.key, franchise, mode, filterKey, day, config.minRatio],
  );
  const rounds = useMemo(
    () => sequence?.(1) ?? buildRounds(pool, metric.key, { franchise, mode, filterKey, day }, MAX_ROUNDS + (session.attemptLimit ?? 1) - 1, config.minRatio),
    [sequence, session.attemptLimit, pool, metric.key, franchise, mode, filterKey, day, config.minRatio],
  );

  if (rounds.length === 0) return <p role="status">{es.higherLower.noRounds}</p>;
  return <HigherLowerBoard session={session} metric={metric} rounds={rounds} extendRounds={sequence} />;
}
