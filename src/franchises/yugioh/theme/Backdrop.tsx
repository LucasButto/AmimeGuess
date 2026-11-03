import styles from './Backdrop.module.scss';

const LEFT_GLYPHS = ['ankh', 'ojo-de-horus', 'escarabajo-alado', 'sol', 'loto', 'halcon', 'cobra', 'ankh'];
const RIGHT_GLYPHS = ['pluma-de-maat', 'ibis', 'ojo-de-horus', 'djed', 'anubis', 'sol', 'escarabajo', 'ankh'];

/** Los jeroglíficos de la hoja aportada (`public/icons/yugioh/jeroglificos/`); ninguna inscripción se dibuja a mano. */
export function DuelBackdrop() {
  return <div className={styles.backdrop} data-backdrop="yugioh" aria-hidden="true">
    {([{ side: 'left', glyphs: LEFT_GLYPHS }, { side: 'right', glyphs: RIGHT_GLYPHS }]).map(({ side, glyphs }) =>
      <span key={side} className={styles.pillar} data-side={side} data-temple-pillar>
        <span className={styles.glyphColumn} aria-hidden="true">
          {glyphs.map((id, index) => <span key={`${id}-${index}`} className={styles.glyph} data-glyph={id} aria-hidden="true" />)}
        </span>
      </span>)}
  </div>;
}
