import { es } from '@/i18n/es';
import styles from './TimelineHelp.module.scss';
import { attemptsOf, countOf, levelsOf } from './logic';
import type { TimelineConfig } from './types';

interface TimelineHelpProps {
  config: TimelineConfig;
}

/** Lo que la línea de tiempo aporta al "Cómo se juega": la meta, cómo se mueven los sucesos y los intentos. */
export function TimelineHelp({ config }: TimelineHelpProps) {
  const levels = levelsOf(config);
  const several = levels.length > 1;
  return (
    <div className={styles.root}>
      <p>{several ? es.timeline.help.goalLevels(levels.map((level) => level.count)) : es.timeline.help.goal(countOf(config))}</p>
      <p>{es.timeline.help.move}</p>
      <p>
        {several
          ? es.timeline.help.attemptsLevels(levels.map((level) => level.attempts ?? attemptsOf(config)))
          : es.timeline.help.attempts(attemptsOf(config))}
      </p>
    </div>
  );
}
