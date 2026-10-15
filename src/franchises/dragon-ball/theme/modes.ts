// Lo propio de cada modo de Dragon Ball en su piel: cuántas estrellas lleva su esfera. Vive acá y no en src/modes/ ni
// en src/components/: los motores no conocen franquicias.

/**
 * Los siete modos que no son el principal, cada uno una esfera del dragón con sus estrellas (1 a 7): el Clásico es la
 * cápsula y estos siete cierran el juego completo de esferas.
 */
export const SPHERE_STARS: Readonly<Record<string, number>> = {
  silueta: 1,
  frase: 2,
  borroso: 3,
  tecnica: 4,
  poder: 5,
  transformacion: 6,
  'linea-de-tiempo': 7,
};

/** Las estrellas de la esfera de un modo; uno nuevo sin entrada propia usa la de 4 estrellas. */
export function starsOf(slug: string): number {
  return SPHERE_STARS[slug] ?? 4;
}
