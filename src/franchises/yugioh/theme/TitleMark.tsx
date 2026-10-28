import type { TitleMarkProps } from '../../types';
import { CardFrame } from './CardFrame';
import { modeCard } from './modeCards';
import styles from './TitleMark.module.scss';

/** Miniatura decorativa: comparte el material y la geometría de las cartas del menú. */
export function CardTitleMark({ slug, index }: TitleMarkProps) {
  return <span className={styles.card} data-duel-title-card aria-hidden="true">
    <CardFrame frame={modeCard(slug).frame} primary={index === 0} mini illustration={null} />
  </span>;
}
