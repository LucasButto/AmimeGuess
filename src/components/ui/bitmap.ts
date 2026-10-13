// Mapas de bits escritos como texto (SPEC 9.2): la única fuente del pixel art de interfaz. Los dibuja
// `PixelArt` como SVG en la página y los convierte en SVG estáticos el script `npm run design:assets`
// (scripts/design/). Sin React ni alias de rutas, para que el script lo pueda importar.

/**
 * Un mapa de bits escrito como texto: una cadena por fila y un carácter por píxel. Cada carácter se
 * pinta con su color de `palette` (un color CSS, normalmente una variable: `var(--palette-red)` o
 * `currentColor`); el punto y el espacio son transparentes.
 */
export interface Bitmap {
  readonly rows: readonly string[];
  readonly palette: Readonly<Record<string, string>>;
}

/** El `d` de un `<path>` por color (aunque lo usen varios caracteres), con los píxeles en tramos horizontales. */
export function pixelPaths({ rows, palette }: Bitmap): Array<{ color: string; d: string }> {
  const byColor = new Map<string, string[]>();
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const color = palette[row[x]];
      let end = x + 1;
      while (end < row.length && palette[row[end]] === color) end++;
      if (row[x] !== '.' && row[x] !== ' ' && color !== undefined) {
        const parts = byColor.get(color) ?? [];
        parts.push(`M${x} ${y}h${end - x}v1h${x - end}z`);
        byColor.set(color, parts);
      }
      x = end;
    }
  });
  return [...byColor].map(([color, parts]) => ({ color, d: parts.join('') }));
}

/** Ancho (la fila más larga) y alto del dibujo, en píxeles de arte. */
export function bitmapSize({ rows }: Bitmap): { width: number; height: number } {
  return { width: Math.max(...rows.map((row) => row.length)), height: rows.length };
}

/** El dibujo como un archivo SVG independiente, con los colores ya resueltos (para public/). */
export function bitmapSvg(art: Bitmap): string {
  const { width, height } = bitmapSize(art);
  const paths = pixelPaths(art)
    .map(({ color, d }) => `<path fill="${color}" d="${d}"/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" shape-rendering="crispEdges">${paths}</svg>\n`;
}
