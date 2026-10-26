// Registro de pieles (SPEC 9.2). Cada franquicia puede tener una en src/franchises/<slug>/theme/; la que no
// tiene, o lo que su piel no define, usa los valores por defecto de src/components/skin/defaults.tsx.

import { DEFAULT_SKIN, DEFAULT_SKIN_DATA, DEFAULT_SLOTS } from '@/components/skin/defaults';
import { dragonBallSkin } from './dragon-ball/theme';
import { narutoSkin } from './naruto/theme';
import { pokemonSkin } from './pokemon/theme';
import type { FranchiseSkin, ResolvedSkin } from './types';

const skins: Readonly<Record<string, FranchiseSkin>> = {
  pokemon: pokemonSkin,
  'dragon-ball': dragonBallSkin,
  naruto: narutoSkin,
};

const resolved = new Map<string, ResolvedSkin>();

/** La piel de una franquicia completada con los valores por defecto. Devuelve siempre el mismo objeto por franquicia. */
export function getSkin(slug: string | null): ResolvedSkin {
  if (slug === null) return DEFAULT_SKIN;
  const cached = resolved.get(slug);
  if (cached) return cached;
  const skin = skins[slug];
  const result: ResolvedSkin = skin
    ? {
        revealMode: skin.revealMode ?? DEFAULT_SKIN_DATA.revealMode,
        shareEmojis: skin.shareEmojis ?? DEFAULT_SKIN_DATA.shareEmojis,
        sounds: skin.sounds ?? DEFAULT_SKIN_DATA.sounds,
        backNavExitMs: Math.min(300, skin.backNavExitMs ?? DEFAULT_SKIN_DATA.backNavExitMs),
        pageExitMs: Math.min(900, skin.pageExitMs ?? DEFAULT_SKIN_DATA.pageExitMs),
        cellIcons: skin.cellIcons ?? DEFAULT_SKIN_DATA.cellIcons,
        cellMarks: skin.cellMarks ?? DEFAULT_SKIN_DATA.cellMarks,
        uniformFilterChips: skin.uniformFilterChips ?? DEFAULT_SKIN_DATA.uniformFilterChips,
        imageBack: skin.imageBack ?? DEFAULT_SKIN_DATA.imageBack,
        winHeadline: skin.winHeadline ?? DEFAULT_SKIN_DATA.winHeadline,
        className: skin.className,
        slots: { ...DEFAULT_SLOTS, ...skin.slots },
      }
    : DEFAULT_SKIN;
  resolved.set(slug, result);
  return result;
}
