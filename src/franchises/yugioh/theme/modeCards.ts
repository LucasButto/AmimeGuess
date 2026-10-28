/** Orden documental; la seleccion en ejecucion siempre es por slug. */
const cards = [
  { slug: 'duelista', frame: 'normal', icon: 'duelist' },
  { slug: 'carta', frame: 'effect', icon: 'card' },
  { slug: 'silueta', frame: 'fusion', icon: 'shadow' },
  { slug: 'texto', frame: 'ritual', icon: 'scroll' },
  { slug: 'arte', frame: 'spell', icon: 'brush' },
  { slug: 'carta-insignia', frame: 'trap', icon: 'cartouche' },
  { slug: 'zoom', frame: 'synchro', icon: 'eye' },
  { slug: 'mayor-o-menor', frame: 'xyz', icon: 'balance' },
  { slug: 'invocacion', frame: 'pendulum', icon: 'summon' },
  { slug: 'deck', frame: 'link', icon: 'deck' },
  { slug: 'linea-de-tiempo', frame: 'maximum', icon: 'timeline' },
] as const;
export type EgyptianIconKind = (typeof cards)[number]['icon'];
export type CardFrameType = (typeof cards)[number]['frame'] | 'neutral';
export function modeCard(slug: string) { return cards.find((card) => card.slug === slug) ?? cards[0]; }
