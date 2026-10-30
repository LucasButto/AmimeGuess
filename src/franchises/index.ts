import { visibleFranchises } from './visibility';
import { dragonBallConfig } from './dragon-ball/config';
import { narutoConfig } from './naruto/config';
import { pokemonConfig } from './pokemon/config';
import type { FranchiseConfig } from './types';
import { yugiohConfig } from './yugioh/config';

/** Las cuatro franquicias, en el orden en que se muestran en el hub. */
export const allFranchises: readonly FranchiseConfig[] = [
  pokemonConfig,
  dragonBallConfig,
  narutoConfig,
  yugiohConfig,
];

/** Registro público: todas las rutas y navegaciones respetan data/mode.json. */
export const franchises = visibleFranchises(allFranchises);

export function getFranchise(slug: string): FranchiseConfig | undefined {
  return franchises.find((franchise) => franchise.slug === slug);
}
