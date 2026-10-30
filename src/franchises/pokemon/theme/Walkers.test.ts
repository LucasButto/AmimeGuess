import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { compile } from 'sass';
import path from 'node:path';
import { PokemonBackdrop } from './Backdrop';
import { PokemonWalkers } from './Walkers';
import manifest from '../../../../public/theme/pokemon/pmd/manifest.json';
import { playbackAnimation, type WalkerManifest } from './walkerMotion';

vi.mock('./Backdrop.module.scss', () => ({ default: {} }));
vi.mock('./Walkers.module.scss', () => ({ default: {} }));
vi.mock('./SpeedToggle.module.scss', () => ({ default: {} }));

describe('montaje de caminantes Pokémon', () => {
  it('el fondo de la piel siempre monta la escena, sin depender de la ruta de un modo', () => {
    const html = renderToStaticMarkup(createElement(PokemonBackdrop));
    expect(html).toContain('data-pmd-scene="true"');
    expect(html).toContain('data-pmd-grass-patches="true"');
    expect(html).not.toContain('data-pmd-home');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('data-pmd-ground');
    for(const layer of ['trees','far-bank','water','bank'])expect(html).toContain(`data-pmd-${layer}`);
  });
  it('no renderiza actores ni pide imágenes durante SSR', () => {
    expect(renderToStaticMarkup(createElement(PokemonWalkers))).toBe('');
  });
  it('las hojas Sass compilan, tienen la defensa de movimiento reducido y sólo animan transform/opacity', () => {
    const root = path.resolve(import.meta.dirname, '../../../..');
    for (const file of ['Backdrop.module.scss', 'Walkers.module.scss']) {
      const css = compile(path.join(import.meta.dirname, file), { loadPaths: [path.join(root, 'src/styles')] }).css;
      expect(css).not.toMatch(/@keyframes[^}]+\{[^}]*(?:width|height|left|top|margin|padding):/);
      if (file === 'Walkers.module.scss') {
        expect(css).toContain('prefers-reduced-motion: reduce');
        expect(css).toContain('image-rendering: pixelated');
        expect(css).toContain('pointer-events: none');
        expect(css).not.toContain("data-movement=burrow");
      } else {
        expect(css).toContain(':not(ul):not([aria-hidden=true])');
        expect(css).toMatch(/~ main[^}]+z-index: 2/);
        expect(css).toMatch(/~ footer[^}]+z-index: 1/);
      }
    }
  });
});


it('elige la locomocion aprobada y las tres poses nativas sin alterar direccion ni datos', () => {
  const pokemon=(manifest as unknown as WalkerManifest).pokemon;
  for(const p of pokemon) for(const v of Object.values(p.variants)) if(v) {
    expect(playbackAnimation(p,v,'walk')).toBe(p.locomotion??'Walk');
    if(p.burrow) {
      expect(playbackAnimation(p,v,'emerge')).toBe('DigIn');
      expect(playbackAnimation(p,v,'burrow-idle')).toBe('Idle');
      expect(playbackAnimation(p,v,'hide')).toBe('DigOut');
    } else if(p.zone==='ground'&&v.hasHitGround) {
      expect(playbackAnimation(p,v,'fall')).toBe('HitGround');
      expect(playbackAnimation(p,v,'recover')).toBe('Idle');
    }
  }
});
