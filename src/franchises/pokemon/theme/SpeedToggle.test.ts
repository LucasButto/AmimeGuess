import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { compile } from 'sass';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { WalkerSpeedToggle } from './SpeedToggle';
import { getWalkerSpeed, setWalkerSpeed } from './walkerSpeed';

vi.mock('./SpeedToggle.module.scss', () => ({ default: {} }));
afterEach(() => { setWalkerSpeed(1); vi.unstubAllEnvs(); });

it('no publica el control en produccion ni crea un portal durante SSR', () => {
  vi.stubEnv('NODE_ENV', 'production');
  expect(renderToStaticMarkup(createElement(WalkerSpeedToggle))).toBe('');
  vi.stubEnv('NODE_ENV', 'development');
  expect(renderToStaticMarkup(createElement(WalkerSpeedToggle))).toBe('');
});

it('el reloj admite solo los cuatro factores y descarta valores invalidos', () => {
  for (const value of [0.5, 1, 2, 3]) { setWalkerSpeed(value); expect(getWalkerSpeed()).toBe(value); }
  for (const value of [0, -1, NaN, Infinity, 4]) { setWalkerSpeed(value); expect(getWalkerSpeed()).toBe(3); }
});

it('reserva espacio solo cuando existe el panel, con objetivos tactiles y foco visible', () => {
  const css = compile(path.join(import.meta.dirname, 'SpeedToggle.module.scss'), {
    loadPaths: [path.resolve(import.meta.dirname, '../../../..', 'src/styles')],
  }).css;
  expect(css).toContain("body:has([data-pmd-speed]) [data-theme-root][data-skin='pokemon']");
  expect(css).toContain('min-block-size: 2.75rem');
  expect(css).toContain('min-inline-size: 2.75rem');
  expect(css).toContain(':focus-visible');
  const source = readFileSync(path.join(import.meta.dirname, 'Walkers.tsx'), 'utf8');
  expect(source).toContain("pokemonSpeedTestEnabled && <WalkerSpeedToggle />");
});
