import { PixelArt } from '@/components/ui/PixelArt';
import type { ModeFrameProps } from '../../types';
import { POKEDEX_LENS, POKEDEX_LIGHT_ROWS, inlineArt } from './art';
import styles from './PokedexFrame.module.scss';

const LIGHTS = ['red', 'yellow', 'grass-1'] as const;

/**
 * Slot `ModeFrame` de Pokémon. El Clásico va dentro de una Pokédex: carcasa roja con una franja de lente y
 * luces arriba, y la tabla en una pantalla de borde hundido. En el teléfono los márgenes de los costados no
 * pasan de 0,5 rem, para no quitarle ancho a la tabla. Los demás motores no llevan marco propio.
 */
export function PokedexFrame({ engine, children }: ModeFrameProps) {
  if (engine !== 'classic') return <>{children}</>;
  return (
    <div className={styles.dex}>
      <div className={styles.strip} aria-hidden="true">
        <PixelArt art={inlineArt(POKEDEX_LENS)} size="fill" className={styles.lens} />
        {LIGHTS.map((color) => (
          <PixelArt key={color} art={inlineArt({ rows: POKEDEX_LIGHT_ROWS, colors: { K: 'frame', H: 'white', C: color } })} size="fill" className={styles.light} />
        ))}
      </div>
      <div className={styles.screen}>{children}</div>
    </div>
  );
}
