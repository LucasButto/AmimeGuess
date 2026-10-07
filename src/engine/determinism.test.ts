// Vigila las reglas 1 y 2 de CLAUDE.md sobre el código de src/engine/: nada
// que dependa del azar, del reloj o de la zona horaria del navegador, y nada
// que conozca React, las páginas, los modos o una franquicia concreta.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = fileURLToPath(new URL('.', import.meta.url));

const sources = readdirSync(dir)
  .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
  .map((file) => ({
    file,
    // Sin comentarios: las explicaciones pueden nombrar lo prohibido.
    code: readFileSync(`${dir}${file}`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''),
  }));

const forbidden: Array<[string, RegExp]> = [
  ['Math.random()', /Math\.random\b/],
  ['Date.now()', /Date\.now\b/],
  ['new Date() sin argumentos (hora actual)', /new Date\(\s*\)/],
  ['getTimezoneOffset', /getTimezoneOffset/],
  ['Intl (formato según la zona o el idioma)', /\bIntl\./],
  ['toLocale*', /\.toLocale\w*\(/],
  ['getters de fecha en hora local', /\.(getFullYear|getMonth|getDate|getDay|getHours|getMinutes|getSeconds|getMilliseconds)\(/],
  ['performance.now()', /performance\.now\b/],
];

const forbiddenImports =
  /from\s+['"](react|react-dom|next|next\/[^'"]*|@\/app[^'"]*|@\/modes[^'"]*|@\/franchises[^'"]*|@\/components[^'"]*|(\.\.\/)+(app|modes|franchises|components)[^'"]*)['"]/;

describe('src/engine', () => {
  it('hay archivos de motor para revisar', () => {
    expect(sources.map((s) => s.file)).toEqual(
      expect.arrayContaining(['hash.ts', 'rng.ts', 'day.ts', 'filters.ts', 'daily.ts', 'compare.ts', 'storage.ts', 'types.ts']),
    );
  });

  it.each(forbidden)('no usa %s', (_name, pattern) => {
    const offenders = sources.filter((s) => pattern.test(s.code)).map((s) => s.file);
    expect(offenders).toEqual([]);
  });

  it('no importa React, Next, ni nada de app, modes, franchises o components', () => {
    const offenders = sources.filter((s) => forbiddenImports.test(s.code)).map((s) => s.file);
    expect(offenders).toEqual([]);
  });
});
