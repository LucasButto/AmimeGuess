import { beforeAll, describe, expect, it } from 'vitest';
import { modeStatus } from '@/app/[franchise]/[mode]/playable';
import { pickDaily, type DailyContext } from '@/engine/daily';
import { eligibleEntities } from '@/engine/filters';
import { franchises } from '@/franchises';
import { entitiesOfMode, loadFranchiseData, type FranchiseData } from '@/franchises/data';
import type { FranchiseConfig, ModeConfig } from '@/franchises/types';
import { es } from '@/i18n/es';
import * as board from '@/modes/category-board/logic';
import * as connections from '@/modes/connections/logic';
import * as higherLower from '@/modes/higher-lower/logic';
import * as image from '@/modes/image-reveal/logic';
import * as list from '@/modes/reveal-list/logic';
import { draw } from '@/modes/stat-builder/logic';
import * as text from '@/modes/text-clue/logic';
import * as timeline from '@/modes/timeline/logic';
import { isVersusDay, versusDay } from '@/versus/seed';
import { clearPracticeStates, isPracticeDay, type KeyedStorage } from '../game-shell/practice';
import { winDays } from '../progress';

// Paso 1.3 de docs/versus/03-fase-1-base.md: cada motor arma su reto con un día de versus (con los datos reales), sin
// fallar y siempre igual. src/engine/ no cambia.

let data: Record<string, FranchiseData>;

beforeAll(async () => {
  data = {};
  for (const franchise of franchises) data[franchise.slug] = (await loadFranchiseData(franchise.slug))!;
});

/** El reto de un modo para un contexto, como lo arma su motor: algo serializable para comparar. */
function challenge(franchise: FranchiseConfig, mode: ModeConfig, loaded: FranchiseData, ctx: DailyContext): unknown {
  const entities = entitiesOfMode(loaded, mode.entitySet);
  const active = franchise.series;
  switch (mode.engine) {
    case 'classic':
      return pickDaily(eligibleEntities(entities, active), ctx).id;
    case 'image-reveal': {
      const answer = pickDaily(image.candidatesOf(entities, loaded.contents, active, mode.imageReveal!), ctx);
      return [answer.id, image.pickImage(answer, ctx)];
    }
    case 'text-clue':
      return pickDaily(text.candidatesOf(entities, loaded.contents, active, mode.textClue!), ctx).id;
    case 'reveal-list':
      return pickDaily(list.candidatesOf(entities, loaded.contents, active, mode.revealList!), ctx).id;
    case 'higher-lower': {
      const pool = higherLower.poolOf(entities, active, mode.higherLower!.metrics);
      const metric = higherLower.metricOfDay(mode.higherLower!.metrics, ctx.day).key;
      return higherLower.endlessRounds(pool, metric, ctx, mode.higherLower!.minRatio)(30).map((round) => [round.a.id, round.b.id]);
    }
    case 'timeline':
      return timeline.levelsOf(mode.timeline!).map((_, level) => {
        const config = timeline.configForLevel(mode.timeline!, level);
        return timeline.buildPuzzle(timeline.poolOf(loaded.contents, active, config), ctx, timeline.countOf(config));
      });
    case 'connections':
      return connections.buildBoard(connections.poolOf(entities, loaded.contents, active, mode.connections!), ctx);
    case 'stat-builder':
      return [0, 1, 2].map((position) => draw(eligibleEntities(entities, active), ctx, 0, position).id);
    case 'category-board': {
      const pool = board.poolOf(entities, active, mode.categoryBoard!);
      const categories = board.categoriesOf(pool, mode.categoryBoard!, { ...es.categoryBoard.wildcard, members: [], wildcard: true }, active);
      return board.buildRound(pool, categories, ctx, 0).map((entity) => entity.id);
    }
  }
}

describe('días de versus en los motores', () => {
  it('cada modo jugable arma su reto con días de versus, siempre igual', () => {
    let checked = 0;
    for (const franchise of franchises) {
      for (const mode of franchise.modes.filter((item) => modeStatus(franchise, item, data[franchise.slug]) === 'playable')) {
        for (const index of [1, 2, 3, 11]) {
          const day = versusDay('sala-de-prueba', index);
          expect(isVersusDay(day)).toBe(true);
          const ctx: DailyContext = { franchise: franchise.slug, mode: mode.slug, filterKey: 'all', day };
          const first = challenge(franchise, mode, data[franchise.slug], ctx);
          expect(first, `${franchise.slug}/${mode.slug}`).toBeTruthy();
          expect(challenge(franchise, mode, data[franchise.slug], ctx), `${franchise.slug}/${mode.slug}`).toEqual(first);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(40);
  });
});

describe('días de versus fuera del modo infinito', () => {
  function memory(keys: string[]): KeyedStorage & { keys: string[] } {
    return {
      keys,
      get length() {
        return this.keys.length;
      },
      key(index: number) {
        return this.keys[index] ?? null;
      },
      removeItem(key: string) {
        this.keys = this.keys.filter((candidate) => candidate !== key);
      },
    };
  }

  it('un día de versus no es de práctica', () => {
    expect(isPracticeDay(versusDay('x', 1))).toBe(false);
    expect(isPracticeDay(1_000_000)).toBe(true);
  });

  it('entrar al modo infinito no borra las partidas de versus', () => {
    const versus = `md:v1:state:pokemon:clasico:all:${versusDay('x', 2)}`;
    const practice = 'md:v1:state:pokemon:clasico:all:1000500';
    const daily = 'md:v1:state:pokemon:clasico:all:300';
    const storage = memory([versus, practice, daily]);
    clearPracticeStates(storage);
    expect(storage.keys).toEqual([versus, daily]);
  });

  it('una partida de versus ganada no cuenta como día ganado', () => {
    const won = JSON.stringify({ attempts: ['a'], result: 'won' });
    const entries = new Map([[`md:v1:state:pokemon:clasico:all:${versusDay('x', 1)}`, won], ['md:v1:state:pokemon:clasico:all:300', won]]);
    const storage = {
      get length() {
        return entries.size;
      },
      key: (index: number) => [...entries.keys()][index] ?? null,
      getItem: (key: string) => entries.get(key) ?? null,
      removeItem: (key: string) => void entries.delete(key),
    };
    expect([...winDays(storage as never)]).toEqual([300]);
  });
});
