import { CardBack } from './CardBack';
import styles from './PageTransition.module.scss';

export function CardEntrance() {
  return <span className={styles.transition} data-page-transition="yugioh" aria-hidden="true">
    <span className={styles.card} data-transition-card><CardBack /></span>
  </span>;
}
