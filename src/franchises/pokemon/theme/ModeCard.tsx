import type { ModeCardProps, ModeIconProps } from '../../types';
import { BallCard } from './BallCard';
import { BallImage } from './BallImage';
import styles from './ModeCard.module.scss';
import { modeLook } from './modes';
import { PokedexCard } from './PokedexCard';

/** Slot `ModeCard` de Pokémon: el modo principal es una Pokédex; el resto, Poké Balls. */
export function PokemonModeCard(props: ModeCardProps) {
  return props.slug === 'clasico' ? <PokedexCard {...props} /> : <BallCard {...props} />;
}

/** Slot `ModeIcon`: miniaturas de 2 rem en la navegación entre modos (Pokédex chica o la bola de su modo). */
export function PokemonModeIcon({ slug, current }: ModeIconProps) {
  return (
    <span className={styles.mini} aria-hidden="true" data-current={current}>
      {slug === 'clasico' ? (
        <img className={styles.dex} src="/icons/pokemon/pokedex.webp" alt="" width={200} height={200} draggable={false} />
      ) : (
        <BallImage ball={modeLook(slug).ball} className={styles.ball} />
      )}
    </span>
  );
}
