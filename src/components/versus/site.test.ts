import { beforeAll, describe, expect, it } from 'vitest';
import { modeStatus } from '@/app/[franchise]/[mode]/playable';
import { franchises } from '@/franchises';
import { loadFranchiseData, type FranchiseData } from '@/franchises/data';
import type { Partida, VersusConfig } from '@/versus/config';
import { isValidForSite, partidaErrors, type SiteCatalog } from './site';

let catalog: SiteCatalog;

beforeAll(async () => {
  const data: Record<string, FranchiseData | undefined> = {};
  for (const franchise of franchises) data[franchise.slug] = await loadFranchiseData(franchise.slug);
  catalog = { franchises, data };
});

const clasico: Partida = { franchise: 'pokemon', mode: 'clasico', engine: 'classic', series: ['g1', 'g2'], timeLimitMs: 95_000 };
const config = (partidas: Partida[]): VersusConfig => ({
  modality: 'timeAttack',
  partidas,
  options: { higherLowerTarget: 10, higherLowerForgiven: 3, statsTarget: 500, statsAggregation: 'best' },
});

describe('isValidForSite', () => {
  it('acepta todos los modos jugables con todas sus series', () => {
    for (const franchise of catalog.franchises) {
      for (const mode of franchise.modes.filter((item) => modeStatus(franchise, item, catalog.data[franchise.slug]) === 'playable')) {
        const partida: Partida = { franchise: franchise.slug, mode: mode.slug, engine: mode.engine, series: [...franchise.series], timeLimitMs: 60_000 };
        expect(partidaErrors(partida, catalog), `${franchise.slug}/${mode.slug}`).toEqual([]);
      }
    }
  });

  it('acepta una sala de varias partidas', () => {
    expect(isValidForSite(config([clasico, { ...clasico, mode: 'silueta', engine: 'image-reveal' }]), catalog)).toBe(true);
  });

  it('rechaza franquicias o modos que no existen o están apagados', () => {
    expect(partidaErrors({ ...clasico, franchise: 'digimon' }, catalog)).not.toEqual([]);
    expect(partidaErrors({ ...clasico, mode: 'grito' }, catalog)).not.toEqual([]);
    // Moveset existe en la configuración de Pokémon pero está apagado en data/mode.json.
    expect(partidaErrors({ ...clasico, mode: 'moveset', engine: 'reveal-list' }, catalog)).not.toEqual([]);
  });

  it('rechaza un motor que no es el del modo', () => {
    expect(partidaErrors({ ...clasico, engine: 'image-reveal' }, catalog)).not.toEqual([]);
  });

  it('rechaza series de otra franquicia', () => {
    expect(partidaErrors({ ...clasico, series: ['g1', 'dbz'] }, catalog)).not.toEqual([]);
  });

  it('acepta las variantes del modo y rechaza las demás', () => {
    const higherLower: Partida = { ...clasico, mode: 'mayor-o-menor', engine: 'higher-lower', series: ['g1', 'g2', 'g3'] };
    const metrics = catalog.franchises.find((franchise) => franchise.slug === 'pokemon')!.modes.find((mode) => mode.slug === 'mayor-o-menor')!.higherLower!.metrics;
    if (metrics.length > 1) expect(partidaErrors({ ...higherLower, variant: `m-${metrics[1].key}` }, catalog)).toEqual([]);
    expect(partidaErrors({ ...higherLower, variant: 'm-inventada' }, catalog)).not.toEqual([]);
    expect(partidaErrors({ ...clasico, variant: 'd2' }, catalog)).not.toEqual([]);
    const timeline: Partida = { franchise: 'naruto', mode: 'linea-de-tiempo', engine: 'timeline', series: ['naruto', 'shippuden', 'boruto'], timeLimitMs: 120_000 };
    expect(partidaErrors({ ...timeline, variant: 'd2' }, catalog)).toEqual([]);
    expect(partidaErrors({ ...timeline, variant: 'd3' }, catalog)).toEqual([]);
    expect(partidaErrors({ ...timeline, variant: 'd4' }, catalog)).not.toEqual([]);
  });

  it('acepta los interruptores que existen y rechaza los demás', () => {
    const dragonBall: Partida = { franchise: 'dragon-ball', mode: 'clasico', engine: 'classic', series: ['db', 'dbz', 'daima', 'super', 'gt'], timeLimitMs: 90_000 };
    expect(partidaErrors({ ...dragonBall, toggles: { filler: false } }, catalog)).toEqual([]);
    expect(partidaErrors({ ...dragonBall, toggles: { turbo: true } }, catalog)).not.toEqual([]);
  });

  it('rechaza filtros con los que el pool no llega al mínimo', () => {
    // Un modo oculto por no llegar al mínimo (SPEC 8) tampoco entra al versus.
    const hidden = catalog.franchises.flatMap((franchise) =>
      franchise.modes.filter((mode) => modeStatus(franchise, mode, catalog.data[franchise.slug]) === 'hidden').map((mode) => ({ franchise, mode })),
    );
    for (const { franchise, mode } of hidden) {
      expect(partidaErrors({ franchise: franchise.slug, mode: mode.slug, engine: mode.engine, series: [...franchise.series] }, catalog)).not.toEqual([]);
    }
    expect(partidaErrors({ ...clasico, series: [] }, catalog)).not.toEqual([]);
  });
});
