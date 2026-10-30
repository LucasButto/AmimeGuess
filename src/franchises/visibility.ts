import { z } from 'zod';
import settings from '../../data/mode.json';
import type { FranchiseConfig } from './types';

export const modeSchema = z.object({ slug: z.string(), name: z.string(), status: z.boolean(), try: z.number().int().positive() });
const sectionSchema = z.object({
  slug: z.string(),
  name: z.string(),
  status: z.boolean(),
  modes: z.array(modeSchema),
  speedTest: z.boolean().optional(),
});

export const modeSettings = z.array(sectionSchema).parse(settings);
export type VisibilitySettings = typeof modeSettings;

/** Ausencias y estados false se ocultan; nunca modificamos las configs originales. */
export function visibleFranchises(configs: readonly FranchiseConfig[], rules: VisibilitySettings = modeSettings): readonly FranchiseConfig[] {
  return configs.flatMap((config) => {
    const section = rules.find((candidate) => candidate.slug === config.slug);
    if (!section?.status) return [];
    return [{ ...config, modes: config.modes.flatMap((mode) => {
      const rule = section.modes.find((rule) => rule.slug === mode.slug && rule.status);
      return rule ? [{ ...mode, try: rule.try }] : [];
    }) }];
  });
}

export const pokemonSpeedTestEnabled = modeSettings.some((section) => section.slug === 'pokemon' && section.status && section.speedTest === true);
