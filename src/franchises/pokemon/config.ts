import type { FranchiseConfig } from '../types';

export const pokemonConfig = {
  slug: 'pokemon',
  name: 'Pokémon',
  series: ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9'],
  modes: [
    { slug: 'clasico', name: 'Clásico', engine: 'classic' },
    { slug: 'silueta', name: 'Silueta', engine: 'image-reveal' },
    { slug: 'descripcion', name: 'Descripción', engine: 'text-clue' },
    { slug: 'carta', name: 'Carta', engine: 'image-reveal' },
    { slug: 'movimiento-insignia', name: 'Movimiento insignia', engine: 'text-clue' },
    { slug: 'zoom', name: 'Zoom', engine: 'image-reveal' },
    { slug: 'grito', name: 'Grito', engine: 'audio-clue' },
    { slug: 'mayor-o-menor', name: 'Mayor o Menor', engine: 'higher-lower' },
    { slug: 'moveset', name: 'Moveset', engine: 'reveal-list' },
  ],
} as const satisfies FranchiseConfig;
