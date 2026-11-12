import { expect, it } from 'vitest';
import dragonBallGenerated from '../../data/dragon-ball/content.json';
import narutoGenerated from '../../data/naruto/content.json';
import yugiohGenerated from '../../data/yugioh/content.json';
import { dragonBallContents } from './dragon-ball/content';
import { narutoContents } from './naruto/content';
import { yugiohContents } from './yugioh/content';
import type { Content } from '../engine/types';

it.each([
  ['Dragon Ball', dragonBallGenerated as Content[], dragonBallContents],
  ['Naruto', narutoGenerated as Content[], narutoContents],
  ['Yu-Gi-Oh', yugiohGenerated as Content[], yugiohContents],
] as const)('%s tiene una sola entrada por frase o evento', (_name, generated, assemble) => {
  expect(generated.some(({ kind }) => kind === 'event' || kind === 'quote')).toBe(false);
  const contents = assemble(generated);
  expect(new Set(contents.map(({ id }) => id)).size).toBe(contents.length);
  expect(contents.some(({ kind }) => kind === 'event')).toBe(true);
});
