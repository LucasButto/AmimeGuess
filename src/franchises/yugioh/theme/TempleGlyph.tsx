import styles from './TempleGlyph.module.scss';

export type TempleGlyphKind = 'ankh' | 'eye' | 'scarab' | 'sun' | 'lotus';

/**
 * Motivos egipcios de un solo color: los jeroglíficos de la hoja (`public/icons/yugioh/jeroglificos/`), usados como máscara
 * para que tomen el color del texto (`currentColor`), como los trazos que reemplazan.
 */
export function TempleGlyph({ kind }: { kind: TempleGlyphKind }) {
  return <span className={styles.glyph} data-glyph-kind={kind} aria-hidden="true" />;
}
