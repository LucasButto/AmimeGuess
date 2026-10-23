import { Chip } from '@/components/ui/Chip';
import { es } from '@/i18n/es';
import styles from './MetricPicker.module.scss';
import type { HigherLowerMetric } from './types';

interface MetricPickerProps {
  metrics: readonly HigherLowerMetric[];
  /** Cuál se eligió, o `null` para la del día (que rota cada día). */
  selected: string | null;
  /** La del día de hoy: dice cuál es, al lado de "Del día". */
  today: HigherLowerMetric;
  onSelect: (key: string | null) => void;
}

/**
 * Selector de qué comparar en Mayor o Menor: "Del día" (la que toca hoy, en rotación) y un botón por medida, con la
 * elegida prendida. Cada una es otra partida del día. Va arriba del juego y no se vuelve a montar al cambiar: el foco
 * queda donde estaba.
 */
export function MetricPicker({ metrics, selected, today, onSelect }: MetricPickerProps) {
  return (
    <div className={styles.root} role="group" aria-label={es.higherLower.metricsLabel}>
      <span className={styles.title}>{es.higherLower.metricsLabel}</span>
      <ul className={styles.list}>
        <li>
          <Chip pressed={selected === null} onClick={() => onSelect(null)}>
            {es.higherLower.metricDaily}
            <span className={styles.detail}>{today.short ?? today.label}</span>
          </Chip>
        </li>
        {metrics.map((metric) => (
          <li key={metric.key}>
            <Chip pressed={selected === metric.key} onClick={() => onSelect(metric.key)}>
              {metric.short ?? metric.label}
            </Chip>
          </li>
        ))}
      </ul>
    </div>
  );
}
