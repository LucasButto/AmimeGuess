import type { CSSProperties } from 'react';
import { VisuallyHidden } from '@/components/VisuallyHidden';
import { es } from '@/i18n/es';
import type { DailyRewardProps } from '../../types';
import styles from './Reward.module.scss';

/** El modo principal (la cápsula): no es una esfera. */
const PRIMARY = 'clasico';

/** En cuántas tajadas verticales se corta la imagen del dragón para que ondule (ver `Reward.module.scss`). */
const SLICES = 24;

/**
 * Slot `DailyReward` de Dragon Ball: si hoy resolviste todas las esferas (los modos que no son el Clásico), Shenlong cruza el cielo del fondo, chiquito,
 * ondulando, de izquierda a derecha y con una pausa entre cruce y cruce. Va detrás del contenido (a la altura del fondo,
 * sobre el paisaje), así que pasa por detrás de los paneles y se ve en el cielo y en los márgenes. Es la misma imagen del
 * dragón de la transición entre pantallas (public/theme/dragon-ball/shenlong.webp). Es solo visual: se lee del estado
 * "resuelto hoy" que ya existe, y no cambia nada del juego. El mensaje "¡Pedí un deseo!" queda como texto oculto para
 * lectores de pantalla.
 */
export function DragonReward({ total, solvedSlugs }: DailyRewardProps) {
  // Cada modo que no es el principal es una esfera, sean cuales sean los que estén prendidos: con todas resueltas hoy se pide el
  // deseo. Si un modo no aparece (apagado o sin contenido), su esfera no se pide: alcanza con las que hay.
  const spheres = total - 1;
  const solvedSpheres = solvedSlugs.size - (solvedSlugs.has(PRIMARY) ? 1 : 0);
  if (spheres < 1 || solvedSpheres < spheres) return null;

  return (
    <>
      <VisuallyHidden role="status">{es.dragonBallSkin.wish}</VisuallyHidden>
      <div className={styles.sky} aria-hidden="true">
        <div className={styles.flight}>
          <div className={styles.bob}>
            <div className={styles.dragon}>
              {Array.from({ length: SLICES }, (_, index) => (
                // `--i` es el lugar de la tajada; `--k`, cuánto se atrasa su onda (más hacia la cola).
                <i key={index} className={styles.slice} style={{ '--i': index, '--k': SLICES - 1 - index } as CSSProperties} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
