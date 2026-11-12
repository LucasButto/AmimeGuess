import type { ModeCardProps, ModeIconProps, TitleMarkProps } from '../../types';
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
export function PokemonModeIcon({ slug, current, variant }: ModeIconProps) {
  return (
    <span className={styles.mini} aria-hidden="true" data-current={current} data-variant={variant}>
      {slug === 'clasico' ? (
        <img className={styles.dex} src="/icons/pokemon/pokedex.webp" alt="" width={200} height={200} draggable={false} />
      ) : (
        <BallImage ball={modeLook(slug).ball} className={styles.ball} />
      )}
    </span>
  );
}

/**
 * Slot `TitleMark`: antes del título de la página de un modo, el ícono de ese modo (la Pokédex en el Clásico; en el resto, su
 * bola), del tamaño de las letras. El título de la franquicia no lleva nada (el tema ya no define viñeta).
 * Decorativo.
 */
export function PokemonTitleMark({ slug }: TitleMarkProps) {
  return (
    <span className={styles.titleMark} aria-hidden="true" data-title-mark="">
      {slug === 'clasico' ? (
        <img className={styles.titleArt} src="/icons/pokemon/pokedex.webp" alt="" width={200} height={200} draggable={false} />
      ) : (
        <BallImage ball={modeLook(slug).ball} className={styles.titleArt} />
      )}
    </span>
  );
}
