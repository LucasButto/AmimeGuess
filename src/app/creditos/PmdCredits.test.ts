import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { compile } from 'sass';
import path from 'node:path';
import credits from '../../../data/pokemon/pmd-credits.json';
import manifest from '../../../public/theme/pokemon/pmd/manifest.json';
import { es } from '@/i18n/es';
import { PmdCredits } from './PmdCredits';
import { pmdAttributions } from './pmd-attributions';

vi.mock('./PmdCredits.module.scss', () => ({ default: {} }));
const escape = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#x27;');

describe('creditos PMD generados', () => {
  it('incluye a todos los artistas del JSON sin nombres copiados a mano', () => {
    const html = renderToStaticMarkup(createElement(PmdCredits));
    expect((html.match(/data-pmd-artist=/g) ?? []).length).toBe(credits.artists.length);
    for (const artist of credits.artists) {
      expect(html).toContain(`data-pmd-artist="${escape(artist.id)}">${escape(artist.name)}</li>`);
    }
    expect(html).toContain(es.credits.pmd.artists(credits.artists.length));
    expect(html).toContain('<details');
    expect(html).not.toContain('<details open');
  });

  it('enlaza licencia, repositorio, explorador e instantanea generada', () => {
    const html = renderToStaticMarkup(createElement(PmdCredits));
    for (const url of [credits.licenseUrl, credits.repository, es.credits.pmd.website.url, `${credits.repository}/tree/${credits.snapshot}`]) expect(html).toContain(`href="${url}"`);
    expect(html).toContain('rel="license noopener noreferrer"');
    expect(html).toContain(credits.snapshot);
    expect(credits.snapshot).toBe(manifest.snapshot);
  });

  it('incluye las coautorias de cada forma y variante desde sus recursos exactos', () => {
    const data = pmdAttributions(credits, manifest);
    const expected = manifest.pokemon.filter(pokemon => pokemon.form !== 'base');
    expect(data.forms.map(form => form.id)).toEqual(expected.map(pokemon => pokemon.entityId));
    expect(new Set(data.forms.map(form => form.form))).toEqual(new Set(['altcolor', 'alternate', 'cutscene', 'galar', 'alola']));
    const html = renderToStaticMarkup(createElement(PmdCredits));
    for (const form of data.forms) {
      expect(html).toContain(`data-pmd-form="${form.id}"`);
      const pokemon = expected.find(pokemon => pokemon.entityId === form.id)!;
      for (const variant of form.variants) {
        const source = pokemon.variants[variant.name as 'normal' | 'shiny']!;
        const resources = new Set(Object.values(source.animations).flatMap(animation => [animation.creditId, ...('shadow' in animation && animation.shadow ? [animation.shadow.creditId] : [])]));
        const ids = new Set(credits.resources.filter(resource => resources.has(resource.id)).flatMap(resource => resource.contributions.map(credit => credit.artistId)));
        expect(new Set(variant.artists.map(artist => artist.id))).toEqual(ids);
        expect(ids.size).toBeGreaterThan(0);
      }
    }
  });

  it('compila el panel compacto responsive sin scroll interno y con foco visible', () => {
    const css = compile(path.join(import.meta.dirname, 'PmdCredits.module.scss'), { loadPaths: [path.resolve(import.meta.dirname, '../..', 'styles')] }).css;
    expect(css).toContain(':focus-visible');
    expect(css).toContain('min-block-size: 2.75rem');
    expect(css).toContain('overflow-wrap: anywhere');
    expect(css).not.toMatch(/overflow(?:-y)?:\s*(?:auto|scroll)/);
  });
});
