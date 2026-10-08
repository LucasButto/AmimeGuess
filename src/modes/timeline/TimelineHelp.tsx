import { es } from '@/i18n/es';
import styles from './TimelineHelp.module.scss';
import { attemptsOf, countOf } from './logic';
import type { TimelineConfig } from './types';

interface TimelineHelpProps {
  config: TimelineConfig;
}

/** Lo que la línea de tiempo aporta al "Cómo se juega": la meta, cómo se mueven los sucesos y los intentos. */
export function TimelineHelp({ config }: TimelineHelpProps) {
  return (
    <div className={styles.root}>
      <p>{es.timeline.help.goal(countOf(config))}</p>
      <p>{es.timeline.help.move}</p>
      <p>{es.timeline.help.attempts(attemptsOf(config))}</p>
    </div>
  );
}
