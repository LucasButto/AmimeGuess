import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ContentVideo } from './ContentVideo';

const render = () =>
  renderToStaticMarkup(createElement(ContentVideo, { stem: 'naruto/0123456789abcdef', poster: 'naruto/c/0123456789abcdef', alt: 'Clip del reto', sizes: '24rem', width: 512, height: 330, className: 'clip' }));

describe('ContentVideo', () => {
  const html = render();
  // El HTML no distingue mayúsculas en los atributos (React escribe playsInline).
  const lower = html.toLowerCase();

  it('es un <video> nativo sobre un archivo estático de public/video, con su póster de public/img', () => {
    expect(html).toContain('<video');
    expect(html).toContain('src="/video/naruto/0123456789abcdef.mp4"');
    expect(html).toContain('poster="/img/naruto/c/0123456789abcdef-512.webp"');
    expect(html).not.toContain('http');
  });

  it('va mudo, en bucle, en línea y cargando de antemano, sin controles ni descarga del navegador', () => {
    expect(html).toContain('muted');
    expect(html).toContain('loop');
    expect(lower).toContain('playsinline');
    expect(html).toContain('preload="auto"');
    expect(html).not.toContain('controls');
    expect(lower).toContain('disablepictureinpicture');
  });

  it('no usa el atributo autoplay (arranca por código, sabiendo si pidió menos movimiento)', () => {
    expect(lower).not.toContain('autoplay');
  });

  it('lleva la clase del juego y la medida del póster', () => {
    expect(html).toContain('class="clip"');
    expect(html).toContain('width="512"');
    expect(html).toContain('height="330"');
  });

  it('el motor de imágenes lo usa solo si el contenido trae clip, con la misma clase de filtros', () => {
    const source = readFileSync('src/modes/image-reveal/RevealImage.tsx', 'utf8');
    expect(source).toContain('video === undefined');
    expect(source).toContain('<ContentVideo className={styles.image}');
  });
});
