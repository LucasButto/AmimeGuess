import styles from './Backdrop.module.scss';

const LEFT_GLYPHS = ['01', '08', '14', '09', '22', '23', '01', '14'];
const RIGHT_GLYPHS = ['23', '09', '01', '22', '14', '08', '23', '08'];

/** Geometría de los vectores aportados; ninguna inscripción se dibuja a mano. */
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
