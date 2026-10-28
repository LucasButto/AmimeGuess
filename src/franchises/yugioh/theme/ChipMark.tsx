import type { ChipMarkProps } from '../../types';
import { CardFrame } from './CardFrame';
import type { CardFrameType } from './modeCards';
import styles from './ChipMark.module.scss';

const FRAMES: Readonly<Record<string, CardFrameType>> = { dm: 'effect', gx: 'fusion', '5ds': 'synchro' };
const GLYPHS: Readonly<Record<string, string>> = { dm: '01', gx: '14', '5ds': '08' };
export function CardChipMark({ on, id }: ChipMarkProps) {
  const frame = id && Object.hasOwn(FRAMES, id) ? FRAMES[id] : 'neutral';
  const glyph = id && Object.hasOwn(GLYPHS, id) ? GLYPHS[id] : null;
  return <span className={styles.card} data-chip-card={on ? 'face' : 'muted'} data-series={id} aria-hidden="true">
    <CardFrame frame={frame} mini illustration={glyph && <span className={styles.glyph} data-chip-glyph={glyph} aria-hidden="true" />} />
    {!on && <span className={styles.offMark} />}
  </span>;
}
