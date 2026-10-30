import { PixelArt } from '@/components/ui/PixelArt';
import type { ModeCardProps, ModeIconProps } from '../../types';
import { inlineArt, MINI_POKEDEX } from './art';
import { BallCard } from './BallCard';
import styles from './ModeCard.module.scss';
import { modeLook } from './modes';
import { PokedexCard } from './PokedexCard';
import { PokeBall } from './PokeBall';

/** Slot `ModeCard` de Pokémon: el modo principal es una Pokédex; el resto, Poké Balls. */
export function PokemonModeCard(props: ModeCardProps) {
  return props.slug === 'clasico' ? <PokedexCard {...props} /> : <BallCard {...props} />;
}

/** Slot `ModeIcon`: miniaturas de 2 rem en la navegación entre modos (Pokédex chica o bola del tono del modo). */
export function PokemonModeIcon({ slug, current, solved }: ModeIconProps) {
  return (
    <span className={styles.mini} aria-hidden="true" data-current={current}>
      {slug === 'clasico' ? (
        <PixelArt art={inlineArt(MINI_POKEDEX)} size="fill" className={styles.dex} />
      ) : (
        <PokeBall tone={modeLook(slug).tone} unit="half" open={solved} />
      )}
    </span>
  );
}
