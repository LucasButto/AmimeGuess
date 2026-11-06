import { z } from 'zod';
import settings from '../../data/mode.json';
import type { FranchiseConfig } from './types';

export const modeSchema = z.object({ slug: z.string(), name: z.string(), status: z.boolean(), try: z.number().int().positive() });
export const sectionSchema = z.object({
  slug: z.string(),
  name: z.string(),
  status: z.boolean(),
  modes: z.array(modeSchema),
  speedTest: z.boolean().optional(),
  appShell: z.boolean().optional(),
  /** `true`: la franquicia se ve como "Próximamente" en el inicio y queda bloqueada (sin juego ni rutas), sin importar `status`. */
  comingSoon: z.boolean().optional(),
});

export const modeSettings = z.array(sectionSchema).parse(settings);
export type VisibilitySettings = typeof modeSettings;

/** ¿La franquicia está marcada "Próximamente"? Manda sobre `status`: bloqueada aunque `status` sea `true`. */
export function isComingSoon(slug: string, rules: VisibilitySettings = modeSettings): boolean {
  return rules.find((candidate) => candidate.slug === slug)?.comingSoon === true;
}

/** El diseño de app requiere una sección activa, que no sea "Próximamente", y su interruptor explícito. */
export function appShellEnabled(slug: string, rules: VisibilitySettings = modeSettings): boolean {
  const section = rules.find((candidate) => candidate.slug === slug);
  return section?.status === true && section.comingSoon !== true && section.appShell === true;
}

/** Ausencias, estados false y franquicias "Próximamente" se ocultan; nunca modificamos las configs originales. */
export function visibleFranchises(configs: readonly FranchiseConfig[], rules: VisibilitySettings = modeSettings): readonly FranchiseConfig[] {
  return configs.flatMap((config) => {
    const section = rules.find((candidate) => candidate.slug === config.slug);
    if (!section?.status || section.comingSoon === true) return [];
    return [{ ...config, modes: section.modes.flatMap((rule) => {
      const mode = config.modes.find((mode) => mode.slug === rule.slug);
      return rule.status && mode ? [{ ...mode, try: rule.try }] : [];
    }) }];
  });
}

/** Un canal del inicio: una franquicia jugable o una "Próximamente" (que se ve, pero no se puede abrir). */
export interface HomeChannel {
  readonly slug: string;
  readonly name: string;
  readonly comingSoon: boolean;
}

/** Los canales del inicio, en el orden de las configs: las franquicias activas y las "Próximamente" (que mandan sobre `status`). */
export function homeChannels(configs: readonly FranchiseConfig[], rules: VisibilitySettings = modeSettings): readonly HomeChannel[] {
  return configs.flatMap((config): HomeChannel[] => {
    const section = rules.find((candidate) => candidate.slug === config.slug);
    if (section?.comingSoon === true) return [{ slug: config.slug, name: config.name, comingSoon: true }];
    return section?.status ? [{ slug: config.slug, name: config.name, comingSoon: false }] : [];
  });
}

export const pokemonSpeedTestEnabled = modeSettings.some((section) => section.slug === 'pokemon' && section.status && section.speedTest === true);
