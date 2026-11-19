import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameSession } from '@/components/game-shell/types';
import type { Entity } from '@/engine/types';
import { ImageRevealBoard } from './ImageRevealBoard';
import type { Candidate } from './logic';
import type { ImageRevealConfig } from './types';

const session: GameSession = { franchise: 'test', mode: 'tecnica', day: 100, filterKey: 'all', active: ['one'], onFinish: vi.fn() };
const entity = (id: string): Entity => ({ id, name: { es: id }, image: `test/${id}`, series: ['one'], aliases: [], attrs: {} });
const entities = ['goku', 'vegeta', 'gohan'].map(entity);
const candidates: Candidate[] = entities.map((item) => ({ id: item.id, entity: item, images: [{ id: `c-${item.id}`, stem: `test/c/${item.id}`, width: 512, height: 288, focus: null, video: `test/${item.id}` }] }));

function render(config: ImageRevealConfig) {
  const entries = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); } });
  return renderToStaticMarkup(createElement(ImageRevealBoard, { session, config, candidates, options: entities }));
}

afterEach(() => vi.unstubAllGlobals());

describe('dificultad del modo de imagen', () => {
  it('por defecto, cada opción lleva su explicación escrita debajo', () => {
    const html = render({ variant: 'blur' });
    expect(html).toContain('Cada intento fallido muestra un poco más de la imagen.');
    expect(html).toContain('Apagado, la imagen se ve en grises hasta que aciertes.');
    expect(html).not.toMatch(/<fieldset[^>]*data-compact/);
  });

  it('compacta: los botones van en una fila y la explicación de cada uno está en su ⓘ, no escrita en la página', () => {
    const html = render({ variant: 'blur', compactDifficulty: true });
    expect(html).toMatch(/<fieldset[^>]*data-compact="true"/);
    // La explicación se abre con el ⓘ (el texto no está en la página hasta abrirlo).
    expect(html).not.toContain('Cada intento fallido muestra un poco más de la imagen.');
    expect(html).not.toContain('Apagado, la imagen se ve en grises hasta que aciertes.');
    expect(html).toContain('Ayuda: Revelar con cada intento');
    expect(html).toContain('Ayuda: Mostrar colores');
  });

  it('el ⓘ no va dentro del botón (un botón dentro de otro no es válido): es su hermano', () => {
    const html = render({ variant: 'blur', compactDifficulty: true });
    expect(html).not.toMatch(/<button[^>]*aria-pressed[^>]*>(?:(?!<\/button>).)*<button/);
  });
});
