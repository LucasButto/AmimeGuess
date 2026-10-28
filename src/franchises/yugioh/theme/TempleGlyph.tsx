import styles from './TempleGlyph.module.scss';

export type TempleGlyphKind = 'ankh' | 'eye' | 'scarab' | 'sun' | 'lotus';

/** Motivos geométricos históricos, dibujados para esta piel. */
const paths: Record<TempleGlyphKind, string> = {
  ankh: 'M32 27c-17-1-13-22 0-22s17 21 0 22ZM32 27v32M17 36h30M26 59h12',
  eye: 'M5 27q27-25 54 0Q32 52 5 27ZM32 17a10 10 0 1 0 0 20 10 10 0 1 0 0-20ZM32 37v16L20 60M49 35l10 11M5 18q27-16 54 0',
  scarab: 'M32 17v38M20 25q12-15 24 0v16q-12 16-24 0ZM20 29 7 22m13 13L6 39m17 6L12 56M44 29l13-7M44 35l14 4M41 45l11 11M26 17l-4-9m16 9 4-9',
  sun: 'M32 10a10 10 0 1 0 0 20 10 10 0 1 0 0-20ZM21 20 2 15l6 19 14 3M43 20l19-5-6 19-14 3M9 23l11 5m-8 3 9 3M55 23l-11 5m8 3-9 3M27 36l5 17 5-17M24 57h16',
  lotus: 'M32 47Q9 43 8 20q21 0 24 27 3-27 24-27-1 23-24 27ZM32 47Q15 27 32 7q17 20 0 40ZM32 47v12M18 59h28',
};

export function TempleGlyph({ kind }: { kind: TempleGlyphKind }) {
  return <svg className={styles.glyph} viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d={paths[kind]} /></svg>;
}
