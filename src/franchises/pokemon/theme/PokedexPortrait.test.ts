import { createElement, type ReactElement, type SyntheticEvent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { compile } from 'sass';
import { PokedexPortrait } from './PokedexPortrait';
import { pokedexPortraitSize, pokedexPortraitUrl } from './pokedexPortraitData';
import entities from '../../../../data/pokemon/entities.json';
import { ContentImage } from '@/components/ContentImage';

vi.mock('./PokedexPortrait.module.scss', () => ({ default: {} }));

const item = { id: 'bulbasaur', label: 'Bulbasaur', imageStem: 'pokemon/bulbasaur', attrs: { pmdPortrait: '/img/pokemon/pmd/0001/normal.png' } };

describe('retrato Normal en la Pokedex', () => {
  it('usa el PNG Normal nativo y nunca el arte oficial del item', () => {
    const html = renderToStaticMarkup(createElement(PokedexPortrait, { item }));
    expect(html).toContain('src="/img/pokemon/pmd/0001/normal.png"');
    expect(html).toContain('width="40" height="40"');
    expect(html).toContain('loading="lazy"'); expect(html).toContain('decoding="async"');
    expect(html).toContain('alt=""'); expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('/img/pokemon/bulbasaur');
    expect(html).not.toContain('srcSet');
    const picker = readFileSync(path.join(import.meta.dirname, 'PokedexPicker.tsx'), 'utf8');
    expect(picker).toContain('<PokedexPortrait');
    expect(picker).not.toContain('ContentImage');
    expect(picker).not.toContain('item.imageStem');
  });

  it('un intento fallido usa Sad a color cuando está disponible', () => {
    expect(pokedexPortraitUrl(item, true)).toBe('/img/pokemon/pmd/0001/sad.png');
    const html = renderToStaticMarkup(createElement(PokedexPortrait, { item, tried: true }));
    expect(html).toContain('src="/img/pokemon/pmd/0001/sad.png"');
    expect(html).toContain('data-emotion="sad"');
    expect(html).toContain('data-tried="true"');
  });

  it('sin Sad conserva Normal y lo identifica para el tratamiento gris', () => {
    const missingSad = { attrs: { pmdPortrait: '/img/pokemon/pmd/1001/normal.png' } };
    expect(pokedexPortraitUrl(missingSad, true)).toBe('/img/pokemon/pmd/1001/normal.png');
    const html = renderToStaticMarkup(createElement(PokedexPortrait, { item: missingSad, tried: true }));
    expect(html).toContain('data-emotion="normal"');
    expect(html).toContain('data-tried="true"');
    expect(html).not.toContain('/sad.png');
  });

  it('si falla Sad reintenta Normal antes de mostrar la interrogación', () => {
    const tree = PokedexPortrait({ item, tried: true });
    const image = tree.props.children as ReactElement<{ onError: (event: SyntheticEvent<HTMLImageElement>) => void }>;
    const frame = { dataset: { emotion: 'sad' } };
    const normal = '/img/pokemon/pmd/0001/normal.png';
    const target = { hidden: false, src: '/img/pokemon/pmd/0001/sad.png', dataset: { normal }, parentElement: frame, getAttribute() { return this.src; } };
    image.props.onError({ currentTarget: target } as unknown as SyntheticEvent<HTMLImageElement>);
    expect(target.src).toBe(normal);
    expect(target.hidden).toBe(false);
    expect(frame.dataset.emotion).toBe('normal');
    image.props.onError({ currentTarget: target } as unknown as SyntheticEvent<HTMLImageElement>);
    expect(target.hidden).toBe(true);
  });

  it('sin retrato o con una ruta distinta muestra el fallback sin pedir imagen', () => {
    for (const value of [null, '', '/img/pokemon/bulbasaur-512.webp', '/img/pokemon/pmd/0001/happy.png', ['otra'], 1]) {
      const html = renderToStaticMarkup(createElement(PokedexPortrait, { item: { attrs: { pmdPortrait: value } } }));
      expect(html).toContain('data-fallback="true"');
      expect(html).not.toContain('<img');
    }
    expect(pokedexPortraitUrl({})).toBeUndefined();
  });

  it('un error de carga oculta el img y activa la misma interrogacion, sin estado por celda', () => {
    const tree = PokedexPortrait({ item });
    const image = tree.props.children as ReactElement<{ onError: (event: SyntheticEvent<HTMLImageElement>) => void }>;
    const frame = { dataset: {} as Record<string, string> };
    const target = { hidden: false, parentElement: frame };
    image.props.onError({ currentTarget: target } as unknown as SyntheticEvent<HTMLImageElement>);
    expect(target.hidden).toBe(true);
    expect(frame.dataset.fallback).toBe('true');
  });

  it('elige zoom entero de 40 pixeles y reserva altura y carril de tipos', () => {
    for (const [width, height, expected] of [[54,80,40],[80,80,80],[79.9,80,40],[150,150,120],[200,150,120]]) {
      expect(pokedexPortraitSize(width,height)).toBe(expected);
      expect(expected % 40).toBe(0);
    }
    const root = path.resolve(import.meta.dirname, '../../../..');
    const css = compile(path.join(import.meta.dirname, 'PokedexPortrait.module.scss')).css;
    expect(css).toContain('image-rendering: pixelated');
    expect(css).toContain('mask: url(');
    expect(css).toContain('display: none');
    const pickerCss = compile(path.join(import.meta.dirname, 'PokedexPicker.module.scss'), { loadPaths: [path.join(root, 'src/styles')] }).css;
    expect(pickerCss).toContain('block-size: 5rem');
  });

  it('los 1025 datos tienen retrato Normal y conservan el arte oficial para el reto', () => {
    expect(entities).toHaveLength(1025);
    for (const entity of entities) {
      expect(pokedexPortraitUrl(entity)).toBe(`/img/pokemon/pmd/${String(entity.attrs.numero).padStart(4,'0')}/normal.png`);
      expect(entity.image).toBe(`pokemon/${entity.id}`);
    }
    // The challenge image renderer still builds official-art variants, never portrait paths.
    const official = renderToStaticMarkup(createElement(ContentImage, { stem: 'pokemon/bulbasaur', alt: '', sizes: '20rem' }));
    expect(official).toContain('/img/pokemon/bulbasaur-512.webp');
    expect(official).not.toContain('/pmd/');
  });
});
