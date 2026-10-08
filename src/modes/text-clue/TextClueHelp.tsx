import { es } from '@/i18n/es';
import styles from './TextClueHelp.module.scss';
import type { TextClueConfig } from './types';

interface TextClueHelpProps {
  config: TextClueConfig;
}

/** Lo que el motor de texto aporta al "Cómo se juega": la meta y las pistas que se desbloquean, sacadas de su config. */
export function TextClueHelp({ config }: TextClueHelpProps) {
  const unlockable = config.lines.filter((line) => line.after > 0);

  return (
    <div className={styles.root}>
      <p>{es.textClue.help.goal}</p>

      {unlockable.length > 0 && (
        <section>
          <h3 className={styles.title}>{es.textClue.help.hintsTitle}</h3>
          <p>{es.textClue.help.hintsIntro}</p>
          <ul className={styles.hints}>
            {unlockable.map((line) => (
              <li key={line.label}>{es.textClue.help.hint(line.label, line.after)}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
