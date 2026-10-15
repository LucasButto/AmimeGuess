import { useId, type SVGProps } from 'react';
import styles from './DragonBall.module.scss';

// Esfera del dragón: dibujo propio (círculo naranja, brillo y estrellas rojas), sin ningún símbolo oficial. Se usa
// en el indicador de carga y, después, en las tarjetas de modo. Los colores salen de la paleta de la piel.

/** Un polígono de estrella de cinco puntas con centro (cx, cy). */
function star(cx: number, cy: number, outer: number, inner: number): string {
  const points: string[] = [];
  for (let index = 0; index < 10; index++) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = (Math.PI / 5) * index - Math.PI / 2;
    points.push(`${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`);
  }
  return points.join(' ');
}

/** Gira unos puntos `degrees` grados en sentido horario alrededor del centro de la esfera (16, 16). Las estrellas no giran: solo cambia dónde van. */
function turn(spots: ReadonlyArray<readonly [number, number]>, degrees: number): ReadonlyArray<readonly [number, number]> {
  const angle = (degrees * Math.PI) / 180;
  return spots.map(([x, y]) => [
    Number((16 + (x - 16) * Math.cos(angle) - (y - 16) * Math.sin(angle)).toFixed(2)),
    Number((16 + (x - 16) * Math.sin(angle) + (y - 16) * Math.cos(angle)).toFixed(2)),
  ]);
}

/** Dónde van las estrellas (en una grilla de 32 × 32) según cuántas lleva la esfera, de 1 a 7. */
const STAR_SPOTS: Readonly<Record<number, ReadonlyArray<readonly [number, number]>>> = {
  1: [[16, 16]],
  // En diagonal: la primera arriba a la izquierda y la segunda abajo a la derecha.
  2: [
    [12, 12],
    [20, 20],
  ],
  3: [
    [16, 10.5],
    [11, 20],
    [21, 20],
  ],
  // El rombo de siempre, girado un poco en sentido horario.
  4: turn(
    [
      [16, 9.5],
      [9.5, 16],
      [22.5, 16],
      [16, 22.5],
    ],
    15,
  ),
  5: [
    [16, 9],
    [9, 14.5],
    [23, 14.5],
    [11.5, 22.5],
    [20.5, 22.5],
  ],
  6: [
    [10, 11],
    [16, 11],
    [22, 11],
    [10, 20],
    [16, 20],
    [22, 20],
  ],
  7: [
    [16, 8.5],
    [9.5, 12.5],
    [22.5, 12.5],
    [16, 16],
    [9.5, 19.5],
    [22.5, 19.5],
    [16, 23.5],
  ],
};

interface DragonBallProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  /** Cuántas estrellas lleva (1 a 7). */
  stars?: number;
  /** Sin brillo (la esfera de un modo pendiente se ve opaca). */
  dull?: boolean;
}

/**
 * La esfera del dragón de `stars` estrellas, de 32 × 32 unidades, que se escala al tamaño que le dé el CSS: una bola
 * naranja translúcida (un degradé que va de amarillo claro arriba a la izquierda a naranja oscuro en el borde), con el
 * reflejo blanco curvo de arriba, un punto de brillo y la luz que rebota abajo; las estrellas, rojas con borde oscuro.
 */
export function DragonBall({ stars = 4, dull = false, ...rest }: DragonBallProps) {
  const gradient = useId();
  const spots = STAR_SPOTS[Math.min(7, Math.max(1, stars))];
  const size = spots.length >= 6 ? 2.6 : spots.length >= 4 ? 3.2 : 3.8;
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" data-dull={dull} {...rest}>
      <defs>
        <radialGradient id={gradient} cx="0.38" cy="0.32" r="0.72">
          <stop className={styles.core} offset="0" />
          <stop className={styles.mid} offset="0.5" />
          <stop className={styles.edge} offset="1" />
        </radialGradient>
      </defs>
      <circle className={styles.rim} cx="16" cy="16" r="14.75" />
      <circle cx="16" cy="16" r="13" fill={`url(#${gradient})`} />
      <path className={styles.bounce} d="M7.5 21.5 Q16 28.5 24.5 21.5 Q16 26 7.5 21.5 Z" />
      {/* El reflejo va debajo de las estrellas: así se cuentan bien en las esferas de 6 y 7. */}
      <path className={styles.shine} d="M5.4 14 Q6.2 6.2 14 4.4 Q8.8 7.2 7.3 14.4 Q6.2 15.4 5.4 14 Z" />
      <circle className={styles.glint} cx="20.8" cy="6.9" r="1" />
      {spots.map(([x, y]) => (
        <polygon key={`${x}-${y}`} className={styles.star} points={star(x, y, size, size * 0.42)} />
      ))}
    </svg>
  );
}
