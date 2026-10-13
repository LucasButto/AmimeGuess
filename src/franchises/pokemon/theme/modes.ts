// Lo propio de cada modo de Pokémon en su piel: el tono de su bola (un color de la paleta) y su ícono.
// Vive acá y no en src/modes/ ni en src/components/: los motores no conocen franquicias.

import type { ModeIconName } from './art';

export const MODE_LOOKS: Readonly<Record<string, { readonly tone: string; readonly icon: ModeIconName }>> = {
  silueta: { tone: 'red', icon: 'silhouette' },
  descripcion: { tone: 'blue', icon: 'sheet' },
  carta: { tone: 'yellow', icon: 'card' },
  'movimiento-insignia': { tone: 'grass-2', icon: 'sparkle' },
  'mayor-o-menor': { tone: 'cyan', icon: 'arrows' },
  moveset: { tone: 'pink', icon: 'squares' },
};

/** El aspecto de un modo; uno nuevo sin entrada propia usa la bola roja con la silueta. */
export function modeLook(slug: string): { readonly tone: string; readonly icon: ModeIconName } {
  return MODE_LOOKS[slug] ?? { tone: 'red', icon: 'silhouette' };
}
