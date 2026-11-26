import { describe, expect, it } from 'vitest';
import { dragonBallConfig } from './dragon-ball/config';
import { narutoConfig } from './naruto/config';
import { loadFranchiseData, withoutFlagged } from './data';
import type { FranchiseConfig } from './types';
import { es } from '@/i18n/es';
import { ATTEMPT_LIMITS, BOARD_SIZE, buildRound, categoriesOf, poolOf } from '@/modes/category-board/logic';
import type { BoardCategory } from '@/modes/category-board/types';
const wildcard: BoardCategory = { ...es.categoryBoard.wildcard, members: [], wildcard: true };

for (const franchise of [narutoConfig, dragonBallConfig] as readonly FranchiseConfig[]) {
  describe(`Casillas de ${franchise.name}`, () => {
    it('conserva el catálogo y las categorías acordadas', async () => {
      const data = (await loadFranchiseData(franchise.slug))!;
      const config = franchise.modes.find((mode) => mode.slug === 'casillas')!.categoryBoard!;
      const size = franchise.slug === 'dragon-ball' ? 83 : 88;
      expect(new Set(config.roster).size).toBe(size);
      expect(poolOf(data.entities, franchise.series, config)).toHaveLength(franchise.slug === 'dragon-ball' ? 78 : size);
      const primaryCount = 8 + config.categories.filter((category) => category.replaces).length;
      expect(config.roster.filter((id) => !config.categories.slice(0, primaryCount).some((category) => category.members.includes(id)))).toEqual([]);
      for (const category of config.categories) {
        expect(category.label).toBeTruthy();
        expect(category.help).toBeTruthy();
        expect(category.members.every((id) => config.roster.includes(id))).toBe(true);
      }
      if (franchise.slug === 'naruto') {
        const members = (id: string) => config.categories.find((item) => item.id === id)!.members;
        expect(config.categories.find((item) => item.id === 'hokage')?.label).toBe('Kages');
        expect(members('hokage')).toHaveLength(19);
        expect(members('hokage')).toEqual(expect.arrayContaining(['gaara', 'a-cuarto-raikage', 'chojuro', 'darui', 'kurotsuchi']));
        expect(members('antagonista')).toEqual(expect.arrayContaining(['gaara', 'kankuro', 'temari', 'baki']));
        expect(members('konoha')).toHaveLength(43);
        expect(members('konoha')).toContain('mitsuki');
        expect(members('konoha')).not.toContain('temari');
        expect(members('otras-aldeas')).toHaveLength(45);
        expect(members('otras-aldeas')).toContain('mitsuki');
        expect(members('otras-aldeas')).toEqual(expect.arrayContaining(['gamabunta', 'gamakichi', 'katsuyu', 'manda', 'fukasaku']));
        expect(members('otras-aldeas')).toEqual(expect.arrayContaining(config.roster.filter((id) => id.endsWith('-otsutsuki'))));
        expect(members('invocacion')).toEqual(expect.arrayContaining(['naruto-uzumaki', 'jiraiya', 'sasuke-uchiha', 'orochimaru', 'hiruzen-sarutobi', 'temari']));
        expect(members('invocacion')).toEqual(expect.arrayContaining(['gamabunta', 'katsuyu', 'manda', 'gamakichi', 'fukasaku', 'hashirama-senju']));
        expect(members('invocacion')).not.toContain('sakon-y-ukon');
        expect(members('invocacion')).toHaveLength(31);
        expect(members('invocacion')).toContain('gengetsu-hozuki');
        expect(members('invocacion')).toContain('shino-aburame');
        expect(config.roster).not.toEqual(expect.arrayContaining(['kurama', 'shukaku', 'gyuki']));
        const edo = ['asuma-sarutobi', 'chiyo', 'rasa', 'mu', 'gengetsu-hozuki', 'yagura-karatachi'];
        expect(members('antagonista')).toEqual(expect.arrayContaining(edo));
        expect(members('jinchuriki')).toContain('yagura-karatachi');
        expect(config.categories.find((item) => item.id === 'antagonista')!.notes).toEqual({ 'edo-tensei': edo });
        for (const id of ['hiruzen-sarutobi', 'minato-namikaze', 'hashirama-senju', 'tobirama-senju']) {
          expect(members('antagonista')).not.toContain(id);
          expect(members('cuarta-guerra')).toContain(id);
        }
      } else {
        expect(config.roster).not.toContain('mr-popo');
        expect(config.roster).toEqual(expect.arrayContaining(['gamma-1', 'gamma-2', 'cabba', 'caulifla', 'kale', 'frost']));
        expect(config.roster).toEqual(expect.arrayContaining(['jiren', 'toppo', 'hit']));
        expect(config.categories.find((category) => category.id === 'antagonista')!.members).toEqual(expect.arrayContaining(['gamma-1', 'gamma-2']));
        expect(config.categories[2].id).toBe('guerreros-z');
        expect(config.categories.some((category) => category.id === 'namekuseijin')).toBe(false);
        expect(config.categories[2].members).toEqual(expect.arrayContaining(['goku', 'vegeta', 'trunks', 'goten', 'piccolo', 'gohan']));
        expect(config.categories[2].members).toHaveLength(17);
        expect(config.categories[2].members).toContain('majin-buu');
        for (const id of ['chi-chi', 'gotenks', 'lunch', 'dende', 'nail', 'gogeta', 'vegetto', 'puar', 'videl', 'bulma']) expect(config.categories[2].members).not.toContain(id);
        expect(config.categories.find((item) => item.id === 'fusion')!.members).toEqual(expect.arrayContaining(['celula', 'piccolo', 'majin-buu']));
        expect(config.categories.find((item) => item.id === 'ejercito-freezer')!.members).toContain('broly');
        const antagonists = config.categories.find((item) => item.id === 'antagonista')!.members;
        expect(antagonists).toEqual(expect.arrayContaining(['champa', 'hit', 'cabba', 'frost', 'jiren', 'toppo', 'caulifla', 'kale', 'kefla']));
        for (const id of ['botamo', 'magetta']) expect(config.roster).not.toContain(id);
        expect(config.categories.find((item) => item.id === 'antagonista')!.members).toEqual(expect.arrayContaining(['chaoz', 'tenshinhan']));
        expect(config.categories.find((item) => item.id === 'antagonista')!.members).not.toContain('yamcha');
        expect(config.roster).not.toContain('kaio-del-este');
      }
    });

    it('ofrece nueve casillas y sorteos sin repetidos para todos los filtros y las tres dificultades', async () => {
      const data = (await loadFranchiseData(franchise.slug))!;
      const config = franchise.modes.find((mode) => mode.slug === 'casillas')!.categoryBoard!;
      for (let bits = 1; bits < 2 ** franchise.series.length; bits++) {
        const active = franchise.series.filter((_, index) => bits & (1 << index));
        for (const skipFiller of [false, true]) {
          const filtered = withoutFlagged(data, { skipFiller, skipMangaOnly: false });
          const pool = poolOf(filtered.entities, active, config);
          const categories = categoriesOf(pool, config, wildcard, active);
          if (franchise.slug === 'dragon-ball') {
            expect(categories.some((category) => category.id === 'torneo-del-poder')).toBe(active.includes('super'));
            const army = config.categories.find((category) => category.id === 'ejercito-freezer')!;
            expect(categories.some((category) => category.id === 'ejercito-freezer')).toBe(pool.some((entity) => army.members.includes(entity.id)));
            if (active.includes('super')) {
              expect(categories.some((category) => category.id === 'fusion')).toBe(false);
              expect(pool.some((entity) => ['gotenks', 'gogeta', 'vegetto', 'kefla', 'kibitoshin'].includes(entity.id))).toBe(false);
            }
            expect(pool.some((entity) => ['jiren', 'toppo', 'hit'].includes(entity.id))).toBe(active.includes('super'));
          }
          expect(categories, active.join('.')).toHaveLength(BOARD_SIZE);
          if (franchise.slug === 'naruto') {
            const war = active.includes('shippuden') && !active.includes('boruto');
            expect(categories.some((category) => category.id === 'cuarta-guerra'), active.join('.')).toBe(war);
            expect(categories.some((category) => category.id === 'jinchuriki'), active.join('.')).toBe(!war);
          }
          for (let level = 0; level < 3; level++) for (let day = 300; day < 306; day++) {
            const ctx = { franchise: franchise.slug, mode: 'casillas', filterKey: `${active.join('.')}~d${level + 1}${skipFiller ? 'x' : ''}`, day };
            for (let attempt = 0; attempt < ATTEMPT_LIMITS[level]; attempt++) {
              const draws = buildRound(pool, categories, ctx, attempt);
              expect(new Set(draws.map((item) => item.id)).size).toBe(BOARD_SIZE);
              expect(draws.every((item) => item.series.some((series) => active.includes(series)))).toBe(true);
            }
          }
        }
      }
    });
  });
}
