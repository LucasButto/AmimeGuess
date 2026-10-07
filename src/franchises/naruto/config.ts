import type { FranchiseConfig } from '../types';

export const narutoConfig = {
  slug: 'naruto',
  name: 'Naruto',
  series: ['naruto', 'shippuden', 'boruto'],
  modes: [
    { slug: 'clasico', name: 'Clásico', engine: 'classic' },
    { slug: 'silueta', name: 'Silueta', engine: 'image-reveal' },
    { slug: 'frase', name: 'Frase', engine: 'text-clue' },
    { slug: 'borroso', name: 'Borroso', engine: 'image-reveal' },
    { slug: 'jutsu', name: 'Jutsu', engine: 'image-reveal' },
    { slug: 'ojo', name: 'Ojo', engine: 'image-reveal' },
    { slug: 'equipo', name: 'Equipo', engine: 'reveal-list' },
    { slug: 'emoji', name: 'Emoji', engine: 'text-clue' },
    { slug: 'conexiones', name: 'Conexiones', engine: 'connections' },
  ],
} as const satisfies FranchiseConfig;
