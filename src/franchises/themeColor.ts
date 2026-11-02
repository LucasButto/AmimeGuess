import { DRAGON_BALL_PALETTE } from './dragon-ball/palette';
import { NARUTO_PALETTE } from './naruto/palette';
import { POKEMON_PALETTE } from './pokemon/palette';
import { YUGIOH_PALETTE } from './yugioh/palette';

/**
 * El color de la barra del navegador (y de la barra de estado de la app instalada) en cada franquicia, sacado de su paleta.
 * En Pokémon es el mismo rojo de la barra superior del juego (`--app-bar-fill`), así las dos se ven como una sola.
 */
export const THEME_COLORS: Readonly<Record<string, string>> = {
  pokemon: POKEMON_PALETTE.red,
  'dragon-ball': DRAGON_BALL_PALETTE.orange,
  naruto: NARUTO_PALETTE.orange,
  yugioh: YUGIOH_PALETTE.tomb,
};

/** El naranja del ícono de la app: el color del inicio y de lo que no es de una franquicia. */
export const SITE_THEME_COLOR = '#fd6408';
