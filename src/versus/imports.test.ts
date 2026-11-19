import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// src/versus/ lo compila también el servidor de salas (wrangler): solo imports relativos y nada de React ni Next. Los
// tests quedan afuera: corren solo en Vitest.
const dir = fileURLToPath(new URL('.', import.meta.url));
const sources = readdirSync(dir).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'));

describe('src/versus/ es lógica pura', () => {
  it('tiene módulos', () => {
    expect(sources.length).toBeGreaterThan(0);
  });

  for (const name of sources) {
    it(`${name} solo importa rutas relativas y zod`, () => {
      const text = readFileSync(`${dir}/${name}`, 'utf8');
      const specifiers = [...text.matchAll(/(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)].map((match) => match[1] ?? match[2]);
      for (const specifier of specifiers) {
        expect(specifier === 'zod' || specifier.startsWith('./') || specifier.startsWith('../'), `${name}: ${specifier}`).toBe(true);
        expect(/react|next/.test(specifier), `${name}: ${specifier}`).toBe(false);
      }
      // Lo relativo que sale de src/versus/ solo puede ir a src/engine/ (por ejemplo, el hash del reto diario).
      for (const specifier of specifiers.filter((value) => value.startsWith('../'))) expect(specifier, name).toMatch(/^\.\.\/engine\/[a-z-]+$/);
    });
  }
});
