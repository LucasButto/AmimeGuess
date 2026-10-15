import { Fragment } from 'react';

/**
 * El texto de un título con cada palabra en su propio `<span data-word="n">` (n desde 0). No cambia nada de cómo se ve: los
 * `span` son en línea y llevan el espacio de siempre entre ellos. Sirve para que un tema pinte cada palabra de su color (el
 * logo de Dragon Ball: una palabra amarilla y la otra roja), sin que el texto deje de ser el mismo para quien lo lee.
 */
export function TitleWords({ text }: { text: string }) {
  return text.split(' ').map((word, index) => (
    <Fragment key={index}>
      {index > 0 && ' '}
      <span data-word={index}>{word}</span>
    </Fragment>
  ));
}
