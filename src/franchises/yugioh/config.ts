import type { FranchiseConfig } from '../types';

export const yugiohConfig = {
  slug: 'yugioh',
  name: 'Yu-Gi-Oh',
  // `sevens` y `gorush` son opcionales y quedan fuera hasta decidirlo (sesión 12).
  series: ['dm', 'gx', '5ds', 'zexal', 'arcv', 'vrains'],
  modes: [
    { slug: 'duelista', name: 'Duelista', engine: 'classic' },
    { slug: 'carta', name: 'Carta', engine: 'classic' },
    { slug: 'silueta', name: 'Silueta', engine: 'image-reveal' },
    { slug: 'texto', name: 'Texto', engine: 'text-clue' },
    { slug: 'arte', name: 'Arte', engine: 'image-reveal' },
    { slug: 'carta-insignia', name: 'Carta insignia', engine: 'image-reveal' },
    { slug: 'zoom', name: 'Zoom', engine: 'image-reveal' },
    { slug: 'mayor-o-menor', name: 'Mayor o Menor', engine: 'higher-lower' },
    { slug: 'invocacion', name: 'Invocación', engine: 'reveal-list' },
    { slug: 'deck', name: 'Deck', engine: 'reveal-list' },
  ],
} as const satisfies FranchiseConfig;
