import { readFileSync } from 'node:fs';
import { compile } from 'sass';
import { describe, expect, it } from 'vitest';

// La imagen del reto es la respuesta sin el filtro: no se puede abrir ni guardar manteniéndola presionada, ni
// seleccionar ni arrastrar (los tres estilos tienen que seguir en su clase).
describe('imagen de la pista (RevealImage)', () => {
  const css = compile('src/modes/image-reveal/RevealImage.module.scss', { loadPaths: ['src/styles'] }).css;
  const block = css.match(/\n\.image\s*\{[^}]*\}/)?.[0] ?? '';

  it('bloquea la pulsación larga, la selección y los eventos sobre la imagen', () => {
    expect(block).toMatch(/pointer-events:\s*none/);
    expect(block).toMatch(/-webkit-touch-callout:\s*none/);
    expect(block).toMatch(/user-select:\s*none/);
  });

  it('la aplica a la imagen del reto y no se puede arrastrar', () => {
    const source = readFileSync('src/modes/image-reveal/RevealImage.tsx', 'utf8');
    expect(source).toContain('className={styles.image}');
    expect(readFileSync('src/components/ContentImage.tsx', 'utf8')).toContain('draggable={false}');
  });
});
