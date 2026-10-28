import { es } from '@/i18n/es';
import type { StreakDisplayProps } from '../../types';
import styles from './StreakDisplay.module.scss';
import { TempleGlyph } from './TempleGlyph';

export function ScarabStreak({ streak }: StreakDisplayProps) {
  return (
    <span className={styles.root}>
      <span className={styles.scarab} aria-hidden="true"><TempleGlyph kind="scarab" /></span>
      <span>{es.yugiohSkin.streak(streak)}</span>
    </span>
  );
}
