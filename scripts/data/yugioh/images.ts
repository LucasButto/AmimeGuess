// Imágenes de Yu-Gi-Oh para el motor image-reveal (SPEC sección 7, "Imágenes"): WebP en dos tamaños,
// 256 y 512 px de lado mayor. La conversión es la de Pokémon (scripts/data/pokemon/images.ts).
//
// Decisión de la sesión 12 (presupuesto de public/img, SPEC 7): la ilustración de cada carta sale en
// los dos tamaños con calidad ≤ 60, y la carta entera solo la de la carta as de cada duelista.

import { CARD, renderImage, type RenderOptions, type Rendered } from '../pokemon/images.ts';

export { imageDimensions, imageFileName, SIZES } from '../pokemon/images.ts';
export { MANUAL_IMAGE_EXTENSIONS, readManualImage, renderEntityImage } from '../dragon-ball/images.ts';
export type { Rendered } from '../pokemon/images.ts';

/** Ilustración recortada de una carta (624 × 624, con fondo): se ve borrosa o ampliada, así que se empieza en calidad 60. */
export const CARD_ART: RenderOptions = {
  qualities: [60, 55, 50, 45, 40, 35, 30],
  budget: { 256: 25 * 1024, 512: 70 * 1024 },
};

/**
 * El monstruo recortado (Silueta): se ve negro y se va aclarando, así que el color importa poco y el borde, algo más.
 * Alfa a 50 y colores desde calidad media hasta muy baja (los monstruos con mucho detalle, como Black Rose Dragon, llegan
 * a 5) para que ~500 siluetas no se coman el presupuesto de public/img (SPEC 7, 200 MB): ≤ 18 KB la de 256 px y ≤ 50 KB la de 512.
 */
export const SILHOUETTE: RenderOptions = {
  qualities: [45, 40, 35, 30, 25, 20, 15, 10, 5],
  alphaQuality: 50,
  budget: { 256: 18 * 1024, 512: 50 * 1024 },
};

export function renderCardArt(id: string, source: Buffer, directory: string): Promise<Rendered[]> {
  return renderImage(id, source, directory, CARD_ART);
}

/** La carta entera (813 × 1185): ≤ 60 KB la de 512 px, como las cartas del TCG de Pokémon. Conserva la proporción. */
export function renderCardFace(id: string, source: Buffer, directory: string): Promise<Rendered[]> {
  return renderImage(id, source, directory, CARD);
}
