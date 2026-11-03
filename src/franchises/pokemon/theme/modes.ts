// Lo propio de cada modo de Pokémon en su piel: qué bola de la hoja lo representa.
// Vive acá y no en src/modes/ ni en src/components/: los motores no conocen franquicias.

import type { BallName } from "./BallImage";

export const MODE_LOOKS: Readonly<Record<string, { readonly ball: BallName }>> = {
  estadisticas: { ball: "master" },
  silueta: { ball: "poke" },
  descripcion: { ball: "super" },
  carta: { ball: "ultra" },
  "movimiento-insignia": { ball: "lujo" },
  "mayor-o-menor": { ball: "veloz" },
  moveset: { ball: "ocaso" },
};

/** La bola de un modo; uno nuevo sin entrada propia usa la Poké Ball. */
export function modeLook(slug: string): { readonly ball: BallName } {
  return MODE_LOOKS[slug] ?? { ball: "poke" };
}
