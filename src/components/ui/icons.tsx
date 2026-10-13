import type { Bitmap } from './bitmap';
import { PixelArt } from './PixelArt';
import styles from './icons.module.scss';

// Íconos pixel genéricos (SPEC 9.2), dibujados acá cuadrícula por cuadrícula. Se pintan con el color del
// texto (`currentColor`), así toman el del tema donde se usen. Los que tienen significado llevan un texto
// accesible: el ícono nunca informa solo, ni solo con su color.

const ink = { '#': 'currentColor' };

export const ICONS = {
  check: { palette: ink, rows: ['......#', '.....##', '#...##.', '##.##..', '.###...', '..#....'] },
  partial: { palette: ink, rows: ['.##....', '#..#..#', '....##.'] },
  cross: { palette: ink, rows: ['#.....#', '##...##', '.##.##.', '..###..', '.##.##.', '##...##', '#.....#'] },
  arrowUp: { palette: ink, rows: ['...#...', '..###..', '.#####.', '#######', '..###..', '..###..', '..###..'] },
  arrowDown: { palette: ink, rows: ['..###..', '..###..', '..###..', '#######', '.#####.', '..###..', '...#...'] },
  info: { palette: ink, rows: ['.#.', '...', '##.', '.#.', '.#.', '.#.', '###'] },
  cursor: { palette: ink, rows: ['#...', '##..', '###.', '####', '###.', '##..', '#...'] },
  more: { palette: ink, rows: ['#######', '.#####.', '..###..', '...#...'] },
  close: { palette: ink, rows: ['##...##', '###.###', '.#####.', '..###..', '.#####.', '###.###', '##...##'] },
  gear: { palette: ink, rows: ['..#.#..', '.#####.', '##...##', '.#...#.', '##...##', '.#####.', '..#.#..'] },
} as const satisfies Record<string, Bitmap>;

export type IconName = keyof typeof ICONS;

interface PixelIconProps {
  name: IconName;
  /** Lo que significa, para lectores de pantalla. Sin él, el ícono es decorativo. */
  label?: string;
  className?: string;
}

/** Un ícono pixel del tamaño de la letra que lo rodea (alto de 1 em). */
export function PixelIcon({ name, label, className }: PixelIconProps) {
  return <PixelArt art={ICONS[name]} label={label} size="fill" className={className ? `${styles.icon} ${className}` : styles.icon} />;
}
