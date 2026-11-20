import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import type { Entity } from '@/engine/types';
import { bestBuild, totalOf } from './logic';
import { TeamCompare } from './TeamCompare';

const stats = [
  { key: 'attack', label: 'Ataque' },
  { key: 'speed', label: 'Velocidad' },
];
const fast: Entity = { id: 'fast', name: { es: 'Veloz' }, image: 'test/fast', series: ['one'], aliases: [], attrs: { attack: 50, speed: 120 } };
const strong: Entity = { id: 'strong', name: { es: 'Fuerte' }, image: 'test/strong', series: ['one'], aliases: [], attrs: { attack: 130, speed: 40 } };
const pool = [fast, strong];

function render(build: { key: string; entityId: string }[]) {
  return renderToStaticMarkup(createElement(TeamCompare, { stats, pool, build, optimal: bestBuild(build, pool) }));
}

it('muestra dos equipos lado a lado: el armado y el mejor posible, con la imagen, la estadística y el valor de cada lugar', () => {
  // La persona puso al lento en Ataque y al rápido en Velocidad: 50 + 40 = 90; lo mejor es al revés: 130 + 120 = 250.
  const html = render([{ key: 'attack', entityId: 'fast' }, { key: 'speed', entityId: 'strong' }]);
  expect(html.match(/<article/g)).toHaveLength(2);
  expect(html).toContain('Tu equipo');
  expect(html).toContain('Mejor equipo posible');
  expect(html).toContain('90 puntos');
  expect(html).toContain('250 puntos');
  expect(html).toContain('/img/test/fast-512.webp');
  expect(html).toContain('/img/test/strong-512.webp');
  expect(html).toContain('>130</strong>');
  expect(html).toContain('>120</strong>');
});

it('en el mejor equipo marca los lugares donde cambia el Pokémon, y solo ahí', () => {
  const html = render([{ key: 'attack', entityId: 'fast' }, { key: 'speed', entityId: 'strong' }]);
  // Cambian los dos lugares, y solo en el equipo de la derecha.
  expect(html.match(/data-changed/g)).toHaveLength(2);
  expect(html).toContain('Cambia de lugar');
});

it('si la combinación ya era óptima no compara: muestra solo la elección de la persona, sin marcar nada', () => {
  const build = [{ key: 'attack', entityId: 'strong' }, { key: 'speed', entityId: 'fast' }];
  expect(totalOf(build, pool)).toBe(250);
  const html = render(build);
  expect(html).not.toContain('data-changed');
  expect(html.match(/<article/g)).toHaveLength(1);
  expect(html).toContain('¡Elegiste la mejor combinación!');
  expect(html).toContain('Tu elección');
  expect(html).not.toContain('Mejor equipo posible');
  expect(html).toContain('>250 puntos<');
  // Cada Pokémon aparece en el lugar que le dio la persona.
  expect(html).toContain('>130</strong>');
  expect(html).toContain('>120</strong>');
});
