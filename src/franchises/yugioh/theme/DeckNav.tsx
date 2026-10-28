import type { BackNavIconProps } from '../../types';
import { CardBack } from './CardBack';
import styles from './DeckNav.module.scss';
import { TempleGlyph } from './TempleGlyph';

/** Solo el dibujo: la caja, las etiquetas y la interacción pertenecen al BackNav común. */
export function DeckNav({ kind, leaving }: BackNavIconProps) {
  return (
    <span className={styles.deck} data-leaving={leaving} data-deck-kind={kind} aria-hidden="true">
      <span className={styles.bottom}><CardBack /></span>
      <span className={styles.middle}><CardBack /></span>
      <span className={styles.top}><CardBack /></span>
      <span className={styles.emblem}><TempleGlyph kind={kind === 'home' ? 'ankh' : 'eye'} /></span>
    </span>
  );
}
