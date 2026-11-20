import styles from './EyeButton.module.scss';

/** El ojo, dibujado en una grilla de 16 × 16 (pixel art, como el resto del versus). `X` es un píxel lleno. */
const EYE = [
  '................',
  '................',
  '................',
  '.....XXXXXX.....',
  '...XX......XX...',
  '..X....XX....X..',
  '.X....XXXX....X.',
  'X....XXXXXX....X',
  '.X....XXXX....X.',
  '..X....XX....X..',
  '...XX......XX...',
  '.....XXXXXX.....',
  '................',
  '................',
  '................',
  '................',
] as const;

/** La raya que lo tacha (de abajo a la izquierda a arriba a la derecha), cuando el código está a la vista. */
const SLASH = Array.from({ length: 12 }, (_, index) => ({ x: 2 + index, y: 13 - index }));

/** Una fila de la grilla a su trazo: una tira de píxeles por cada tramo de `X`. */
function pathOf(rows: readonly string[]): string {
  let path = '';
  rows.forEach((row, y) => {
    for (const run of row.matchAll(/X+/g)) path += `M${run.index} ${y}h${run[0].length}v1h-${run[0].length}z`;
  });
  return path;
}

const OPEN_PATH = pathOf(EYE);
const SLASH_PATH = SLASH.map(({ x, y }) => `M${x} ${y}h2v1h-2z`).join('');

interface EyeButtonProps {
  /** Si lo escondido está a la vista ahora. */
  shown: boolean;
  onToggle: () => void;
  /** Lo que dice el botón mientras está escondido (qué pasa si se toca) y mientras está a la vista. */
  showLabel: string;
  hideLabel: string;
  className?: string;
}

/**
 * El botón del ojito de los campos que van escondidos (el código de la sala): con el código escondido muestra el ojo abierto
 * ("tocá para ver"); con el código a la vista, el ojo tachado ("tocá para esconder"). Un solo botón, con `aria-pressed`.
 */
export function EyeButton({ shown, onToggle, showLabel, hideLabel, className }: EyeButtonProps) {
  return (
    <button type="button" className={className ? `${styles.eye} ${className}` : styles.eye} aria-pressed={shown} aria-label={shown ? hideLabel : showLabel} title={shown ? hideLabel : showLabel} onClick={onToggle}>
      <svg viewBox="0 0 16 16" aria-hidden="true" shapeRendering="crispEdges" focusable="false">
        <path d={OPEN_PATH} fill="currentColor" />
        {shown && <path d={SLASH_PATH} fill="currentColor" />}
      </svg>
    </button>
  );
}
