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

/**
 * El color del inicio y de lo que no es de una franquicia: el azul noche de la sala del televisor (`--hub-night` en
 * `src/app/page.module.scss`). El naranja del ícono de la app no combinaba con la sala. Si se cambia, cambiar también `--system-bar`
 * en `src/styles/globals.scss` y el manifest.
 */
export const SITE_THEME_COLOR = '#0d1220';
