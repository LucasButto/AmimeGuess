import { useId } from 'react';
import type { Stats } from '@/engine/storage';
import { es } from '@/i18n/es';
import { VisuallyHidden } from '../VisuallyHidden';
import styles from './StatsView.module.scss';
import { bestScore, distributionRows, rowHolds, winRate } from './stats';
import type { ResultKind } from './types';

interface StatsViewProps {
  stats: Stats;
  /** Racha vigente hoy (ver `activeStreak`), que puede ser menor que la guardada si se cortó. */
  streak: number;
  /** Intentos (o puntaje, en un modo de puntaje) de la partida que terminó recién, para resaltarla en el gráfico. */
  latestWin?: number;
  /** Cómo se mide el resultado del modo. Por defecto, en intentos. */
  kind?: ResultKind;
}

/**
 * Contenido del modal de estadísticas: partidas, rachas y distribución. En un modo de intentos muestra
 * el porcentaje de victorias y los intentos por victoria; en uno de puntaje, el mejor puntaje y los
 * aciertos seguidos por partida (ahí no hay victorias: toda partida terminada cuenta).
 */
export function StatsView({ stats, streak, latestWin, kind = 'attempts' }: StatsViewProps) {
  const titleId = useId();
  if (stats.played === 0) return <p className={styles.empty}>{es.shell.statsView.noGames}</p>;

  const scored = kind === 'score';
  const rows = distributionRows(stats.distribution, 12, scored ? 0 : 1);
  const tallest = Math.max(1, ...rows.map((row) => row.count));
  const tiles = [
    { label: es.shell.statsView.played, value: String(stats.played) },
    scored
      ? { label: es.shell.statsView.bestScore, value: String(bestScore(stats.distribution)) }
      : { label: es.shell.statsView.winRate, value: `${winRate(stats)}%` },
    { label: es.shell.statsView.currentStreak, value: String(streak) },
    { label: es.shell.statsView.maxStreak, value: String(stats.maxStreak) },
  ];

  return (
    <div className={styles.root}>
      <dl className={styles.tiles}>
        {tiles.map((tile) => (
          <div key={tile.label} className={styles.tile}>
            <dt className={styles.label}>{tile.label}</dt>
            <dd className={styles.value}>{tile.value}</dd>
          </div>
        ))}
      </dl>

      {rows.length > 0 && (
        <section aria-labelledby={titleId}>
          <h3 className={styles.subtitle} id={titleId}>
            {scored ? es.shell.statsView.scoreDistribution : es.shell.statsView.distribution}
          </h3>
          <ol className={styles.bars}>
            {rows.map((row) => (
              <li key={row.label} className={styles.row}>
                <VisuallyHidden>
                  {scored
                    ? es.shell.statsView.scoreDistributionRow(row.label, row.count)
                    : es.shell.statsView.distributionRow(row.label, row.count)}
                </VisuallyHidden>
                <span className={styles.rowLabel} aria-hidden="true">
                  {row.label}
                </span>
                <span className={styles.track} aria-hidden="true">
                  {row.count > 0 && (
                    <span
                      className={styles.bar}
                      data-latest={latestWin !== undefined && rowHolds(row, latestWin)}
                      // Ancho calculado a partir de los datos: es un valor de ejecución, no un estilo fijo.
                      style={{ inlineSize: `${Math.round((100 * row.count) / tallest)}%` }}
                    />
                  )}
                </span>
                <span className={styles.count} aria-hidden="true">
                  {row.count}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
