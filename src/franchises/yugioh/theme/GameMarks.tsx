import type { MetricMarkProps, ModeFrameProps, ValueMarkProps } from '../../types';
import { es } from '@/i18n/es';
import { CardBack } from './CardBack';
import { classFrame } from './gamePresentation';
import styles from './GameMarks.module.scss';

export function DuelCellBack() {
  return <span className={styles.back} aria-hidden="true" data-duel-cell-back><CardBack /></span>;
}

export function DuelImageBack() {
  return <span className={styles.imageBack} aria-hidden="true" data-duel-image-back><CardBack /></span>;
}

/** El valor escrito del motor permanece; la banda es solo el material del marco. */
export function ClassMark({ column, value }: ValueMarkProps) {
  return column === 'clase' ? <span className={styles.classMark} data-duel-class={classFrame(value)} aria-hidden="true" /> : null;
}

export function DuelMetric({ metric }: MetricMarkProps) {
  if (metric !== 'atk' && metric !== 'def' && metric !== 'nivel') return null;
  return <span className={styles.metric} aria-hidden="true">
    <svg viewBox="0 0 32 32" focusable="false"><path d={metric === 'atk' ? 'M6 3 24 21l-3 3L3 6ZM17 24l7-7M23 23l6 6M25 29l4-4' : metric === 'def' ? 'M5 4h22v11c0 7-11 14-11 14S5 22 5 15ZM16 7v17M9 13h14' : 'm16 3 4 8 9 1-6.5 6.5L24 28l-8-4.5L8 28l1.5-9.5L3 12l9-1Z'} /></svg>
    <span>{es.yugiohGames.metrics[metric]}</span>
  </span>;
}

export function DuelFrame({ children }: ModeFrameProps) {
  return <div className={styles.frame} data-duel-table>{children}</div>;
}
