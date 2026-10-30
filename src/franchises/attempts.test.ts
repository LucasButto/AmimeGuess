import { describe, expect, it } from 'vitest';
import { attemptLimit } from '@/components/game-shell/attempts';
import { loadFranchiseData } from './data';
import { franchises } from './index';
import { modePoolSize } from './pool';

describe('presupuestos en todos los modos y series', () => {
  for (const franchise of franchises) {
    it(`${franchise.name}: todos los modos respetan try con el catálogo completo y cada serie`, async () => {
      const data = (await loadFranchiseData(franchise.slug))!;
      for (const mode of franchise.modes) {
        const full = modePoolSize(mode, data, franchise.series)!;
        const adaptive = ['classic', 'image-reveal', 'text-clue', 'reveal-list'].includes(mode.engine);
        expect(attemptLimit(mode.try!, full, full, adaptive)).toBe(mode.try);
        for (const series of franchise.series) {
          const size = modePoolSize(mode, data, [series])!;
          const limit = attemptLimit(mode.try!, size, full, adaptive);
          expect(limit, `${mode.slug}: ${series}`).toBeGreaterThan(0);
          expect(limit, `${mode.slug}: ${series}`).toBeLessThanOrEqual(mode.try!);
          if (!adaptive) expect(limit).toBe(mode.try);
        }
      }
    });
  }
});
