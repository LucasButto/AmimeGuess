import { useContext } from 'react';
import { AttemptRules } from '@/components/game-shell/AttemptRules';
import { useVersusVariant } from '@/components/versus/VersusGameContext';
import { es } from '@/i18n/es';
import styles from './HigherLowerHelp.module.scss';
import type { HigherLowerConfig } from './types';

interface HigherLowerHelpProps {
  config: HigherLowerConfig;
}

/** Lo que Mayor o Menor aporta al "Cómo se juega": la meta, cómo termina y qué se compara cada día. */
export function HigherLowerHelp({ config }: HigherLowerHelpProps) {
  const mistakes = useContext(AttemptRules)?.base ?? 1;
  // En una sala la meta y los fallos perdonados los fijan las opciones de la sala: están escritos en "En esta sala", y acá no se repite lo de siempre.
  const inVersus = useVersusVariant() !== null;
  return (
    <div className={styles.root}>
      {!inVersus && <p>{mistakes === 1 ? es.higherLower.help.goal : es.higherLower.help.goalWithMistakes(mistakes)}</p>}
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
