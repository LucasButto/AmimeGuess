import { es } from '@/i18n/es';
import styles from './RevealListHelp.module.scss';

/** Lo que el motor de lista aporta al "Cómo se juega": la meta y cómo se revelan las pistas. */
export function RevealListHelp() {
  return (
    <div className={styles.root}>
      <p>{es.revealList.help.goal}</p>
      <p>{es.revealList.help.reveal}</p>
    </div>
  );
}
