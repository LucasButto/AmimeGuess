import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { writeState } from '@/engine/storage';
import type { GameSession } from '@/components/game-shell/types';
import type { Entity } from '@/engine/types';
import { StatBuilderBoard } from './StatBuilderGame';

const session: GameSession = { franchise: 'test', mode: 'stats', day: 100, filterKey: 'all', active: ['one'], onFinish: vi.fn() };
afterEach(() => vi.unstubAllGlobals());
it('keeps the sixth entity and its values until the player asks for the result, including after reload', () => {
  const stats = Array.from({length: 6}, (_, i) => ({key: `s${i}`, label: `Stat ${i}`}));
  const entity: Entity = {id:'last', name:{es:'Last entity'}, image:'test/last', series:['one'], aliases:[], attrs:Object.fromEntries(stats.map((stat, i) => [stat.key, 70+i]))};
  const build = stats.map((stat) => ({key:stat.key, entityId:entity.id}));
  const entries = new Map<string,string>();
  const storage = {getItem:(key:string) => entries.get(key) ?? null, setItem:(key:string,value:string) => {entries.set(key,value);} };
  vi.stubGlobal('localStorage',storage);
  writeState(storage,session,{attempts:[build],draft:build,result:'playing'});
  const html = renderToStaticMarkup(createElement(StatBuilderBoard,{session, config:{stats, targets:[400]}, pool:[entity], target:400, limit:4, maximum:255}));
  expect(html).toContain('Last entity');
  expect(html).toContain('/img/test/last-512.webp');
  expect(html).toContain('aria-label="Ver resultado"');
  expect(html).not.toMatch(/disabled=""[^>]*aria-label="Ver resultado"/);
  for(let value=70;value<=75;value++) expect(html).toContain(`>${value}</span>`);
  expect(html).not.toContain('Revelando resultado');
  expect(html).toContain('data-over="false"');
});
