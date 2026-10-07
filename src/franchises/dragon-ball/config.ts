import type { FranchiseConfig } from '../types';

export const dragonBallConfig = {
  slug: 'dragon-ball',
  name: 'Dragon Ball',
  series: ['db', 'dbz', 'gt', 'super', 'daima'],
  seriesLabels: {
    db: 'Dragon Ball',
    dbz: 'Dragon Ball Z',
    gt: 'Dragon Ball GT',
    super: 'Dragon Ball Super',
    daima: 'Dragon Ball Daima',
  },
  modes: [
    { slug: 'clasico', name: 'Clásico', engine: 'classic' },
    { slug: 'silueta', name: 'Silueta', engine: 'image-reveal' },
    { slug: 'frase', name: 'Frase', engine: 'text-clue' },
    { slug: 'borroso', name: 'Borroso', engine: 'image-reveal' },
    { slug: 'tecnica', name: 'Técnica', engine: 'image-reveal' },
    { slug: 'zoom', name: 'Zoom', engine: 'image-reveal' },
    { slug: 'poder', name: 'Nivel de poder', engine: 'higher-lower' },
    { slug: 'transformacion', name: 'Transformación', engine: 'image-reveal' },
    { slug: 'linea-de-tiempo', name: 'Línea de tiempo', engine: 'timeline' },
  ],
} as const satisfies FranchiseConfig;
