import { es } from '@/i18n/es';
import styles from './HigherLowerHelp.module.scss';
import type { HigherLowerConfig } from './types';

interface HigherLowerHelpProps {
  config: HigherLowerConfig;
}

/** Lo que Mayor o Menor aporta al "Cómo se juega": la meta, cómo termina y qué se compara cada día. */
export function HigherLowerHelp({ config }: HigherLowerHelpProps) {
  return (
    <div className={styles.root}>
      <p>{es.higherLower.help.goal}</p>
      <p>{es.higherLower.help.sequence}</p>

      <section>
        <h3 className={styles.title}>{es.higherLower.help.metricsTitle}</h3>
        <p>{es.higherLower.help.metricsIntro}</p>
        <ul className={styles.metrics}>
          {config.metrics.map((metric) => (
            <li key={metric.key}>
              {metric.label}
              {metric.note && <span className={styles.note}> {metric.note}</span>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
