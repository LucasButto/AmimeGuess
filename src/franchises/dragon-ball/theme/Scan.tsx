import { es } from '@/i18n/es';
import type { ValueMarkProps } from '../../types';
import styles from './Scan.module.scss';

/**
 * Slot `CellBack` de Dragon Ball: el dorso de cada celda del Clásico es un visor de scouter oscuro con una cuadrícula y una
 * línea verde que lo recorre de arriba abajo mientras la celda se revela ("escaneo"); después el dorso se desvanece y
 * aparece la cara (revelación `swap`).
 */
export function ScouterBack() {
  return (
    <span className={styles.back} aria-hidden="true">
      <span className={styles.scan} />
    </span>
  );
}

/** Un número estable (sin azar) a partir de un texto: así la misma celda dice siempre lo mismo. */
function hashOf(text: string): number {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.codePointAt(0)!) % 9973;
  return hash;
}

/**
 * Slot `ValueMark` de Dragon Ball: una onomatopeya de manga ("¡ZAS!", "¡PUM!"…) que aparece un instante sobre cada celda
 * recién revelada y se desvanece en 400 ms. Solo se anima en la fila nueva (el CSS la mira dentro de una celda que se está
 * revelando); en las demás y con movimiento reducido no se ve. Decorativa: el valor ya está escrito.
 */
export function Onomatopoeia({ column, value }: ValueMarkProps) {
  const words = es.dragonBallSkin.onomatopoeia;
  return (
    <span className={styles.pop} aria-hidden="true">
      {words[hashOf(`${column}:${value}`) % words.length]}
    </span>
  );
}
