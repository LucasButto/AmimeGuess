import sharp from 'sharp';
import { walkerScale, withWalkerHeights, type WalkerPokemon } from '../../../src/franchises/pokemon/theme/walkerMotion.ts';

export const SIZE_VIEWPORT = { width: 1920, height: 1080, rem: 16, artPixel: 4, ground: 336, skyFloor: 604 };
export interface SizeSample { id: string; zone: 'ground' | 'sky'; height: number; elongated?: boolean; area: number; heightScale: number }
const response = (sample: SizeSample) => (sample.zone === 'sky' ? 0.83 : 1) * (sample.height * (sample.elongated ? 0.4 : 1)) ** 0.75;
export function calibrateSizes(samples: readonly SizeSample[]) {
  if (!samples.length || samples.some(s => s.area <= 0 || s.height <= 0 || s.heightScale <= 0)) throw new Error('Invalid PMD size sample');
  const ratios = samples.filter(s => s.zone === 'ground').map(s => Math.sqrt(s.area) * s.heightScale / response(s)).sort((a, b) => a - b);
  if (!ratios.length) throw new Error('No ground calibration samples');
  const k = ratios[Math.floor(ratios.length / 2)];
  const factors = Object.fromEntries(samples.map(s => {
    const areaScale = Math.max(s.zone === 'sky' ? 34 : 40, k * response(s)) / Math.sqrt(s.area);
    const factor = Math.round(Math.sqrt(areaScale / s.heightScale) * 1000) / 1000;
    if (!Number.isFinite(factor) || factor < 0.5 || factor > 2) throw new Error(`Size factor out of range: ${s.id} ${factor}`);
    return [s.id, factor];
  }));
  return { k, factors };
}

export async function generateSizeFactors(pokemon: readonly WalkerPokemon[], entities: Parameters<typeof withWalkerHeights>[1], publicRoot: string) {
  const samples: SizeSample[] = [];
  for (const p of withWalkerHeights(pokemon, entities)) {
    const sheet = p.variants.normal.animations.Walk.directions.east;
    const frame = sheet.frames[0];
    const pixels = await sharp(`${publicRoot}${sheet.url}`).extract({ left: frame.x, top: frame.y, width: sheet.frameWidth, height: sheet.frameHeight }).ensureAlpha().raw().toBuffer();
    let area = 0;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0) area++;
    // Reproduce the previous grass-only ground budget for calibration, not the new runtime budget.
    const viewport = { ...SIZE_VIEWPORT, skyFloor: p.zone === 'sky' ? SIZE_VIEWPORT.skyFloor : undefined };
    samples.push({ id: p.entityId, zone: p.zone, height: p.heightMeters ?? 1, elongated: p.elongated, area, heightScale: walkerScale({ ...p, sizeFactor: undefined }, p.variants.normal, viewport) });
  }
  return calibrateSizes(samples);
}
