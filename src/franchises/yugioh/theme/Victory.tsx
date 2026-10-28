import type { WinCelebrationProps } from '../../types';
import { es } from '@/i18n/es';
import { AnimatedPoints } from './LifePoints';
import styles from './Victory.module.scss';

export function DuelVictory({ part }: WinCelebrationProps) {
  if (part === 'media') return <span className={styles.seal} aria-hidden="true" />;
  return <div className={styles.victory} data-duel-victory>
    <strong>{es.yugiohGames.won}</strong>
    <span role="img" aria-label={es.yugiohGames.rivalDefeated}>{es.yugiohGames.rivalLP} <span aria-hidden="true"><AnimatedPoints value={0} initial={8000} /></span></span>
  </div>;
}
