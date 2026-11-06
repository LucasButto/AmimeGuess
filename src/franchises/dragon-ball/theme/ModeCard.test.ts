import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { dragonBallConfig } from '../config';
import { modeSettings, visibleFranchises } from '../../visibility';
import { DragonModeCard, DragonModeIcon, DragonTitleMark } from './ModeCard';

vi.mock('@/components/skin/context', () => ({ useSkin: () => ({ leaveTo: () => undefined }) }));

function iconSources(slug: string, index: number): string[] {
  return [
    renderToStaticMarkup(createElement(DragonModeCard, { slug, index, name: slug, href: `/dragon-ball/${slug}`, label: slug, state: 'pending' })),
    renderToStaticMarkup(createElement(DragonModeIcon, { slug, index, current: false, solved: false })),
    renderToStaticMarkup(createElement(DragonTitleMark, { slug, index })),
  ];
}

it('asigna las esferas a los siete modos visibles posteriores al Clásico', () => {
  for (const powerEnabled of [false, true]) {
    const rules = modeSettings.map((section) => section.slug !== 'dragon-ball' ? section : {
      ...section,
      modes: section.modes.map((mode) => mode.slug === 'poder' ? { ...mode, status: powerEnabled } : mode),
    });
    const modes = visibleFranchises([dragonBallConfig], rules)[0].modes;
    expect(modes[0].slug).toBe('clasico');
    const [card, icon, title] = iconSources('clasico', 0);
    expect(card).toContain('data-card="capsule"');
    expect(icon).toContain('botella-azul.webp');
    expect(title).toContain('botella-azul.webp');
    modes.slice(1, 8).forEach((mode, position) => {
      for (const markup of iconSources(mode.slug, position + 1)) expect(markup).toContain(`esfera-${position + 1}.webp`);
    });
    const extra = modes[8];
    if (extra) for (const markup of iconSources(extra.slug, 8)) expect(markup).toContain('scouter.webp');
  }
});
