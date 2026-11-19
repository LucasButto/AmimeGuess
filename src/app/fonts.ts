import localFont from 'next/font/local';
import { Bangers, Cinzel_Decorative, Jersey_10, Permanent_Marker, Press_Start_2P, Rubik, Shippori_Mincho, Silkscreen, Teko } from 'next/font/google';

// Tipografías de los temas (SPEC 9.2; como mucho dos por franquicia). `next/font` las baja una sola vez en el
// build y las sirve desde el propio sitio como archivos estáticos: no se pide nada a Google en producción.
// `preload: false` hace que cada visita descargue solo la que usa: el CSS de todas está siempre, pero el
// navegador baja una fuente recién cuando algo la necesita.
// Las opciones van escritas a mano en cada llamada: `next/font` las lee al compilar y no admite valores compartidos.
// Cada variable CSS (`--font-*`) coincide con un id de `ThemeFont` en src/franchises/types.ts.
const pressStart = Press_Start_2P({ weight: '400', subsets: ['latin'], display: 'swap', preload: false, variable: '--font-press-start-2p' });
const jersey = Jersey_10({ weight: '400', subsets: ['latin'], display: 'swap', preload: false, variable: '--font-jersey-10' });
const rubik = Rubik({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-rubik' });
const bangers = Bangers({ weight: '400', subsets: ['latin'], display: 'swap', preload: false, variable: '--font-bangers' });
const marker = Permanent_Marker({ weight: '400', subsets: ['latin'], display: 'swap', preload: false, variable: '--font-permanent-marker' });
const shippori = Shippori_Mincho({ weight: ['400', '700'], subsets: ['latin'], display: 'swap', preload: false, variable: '--font-shippori-mincho' });
const decorative = Cinzel_Decorative({ weight: ['400', '700'], subsets: ['latin'], display: 'swap', preload: false, variable: '--font-cinzel-decorative' });
// Retro Battle (el versus): títulos condensados estilo arcade (Teko) y códigos y números pixelados (Silkscreen).
const teko = Teko({ weight: ['500', '600', '700'], subsets: ['latin'], display: 'swap', preload: false, variable: '--font-teko' });
const silkscreen = Silkscreen({ weight: ['400', '700'], subsets: ['latin'], display: 'swap', preload: false, variable: '--font-silkscreen' });

// Retro Battle: la tipografía propia de los títulos del versus (AnimeGuess Pixel, solo la regular). Un "píxel" de la fuente mide
// 0.1em: con tamaños que sean múltiplos de 10 px los bordes quedan nítidos. El rango de pesos evita que el navegador la engrose.
const versus = localFont({
  src: [{ path: './fonts/AnimeGuessPixel-Regular.woff2', weight: '100 900', style: 'normal' }],
  display: 'swap',
  preload: false,
  variable: '--font-versus',
});

/** Clases que declaran las variables `--font-*`: van en `<html>`, así cualquier tema las puede usar. */
export const fontVariables = [pressStart, jersey, rubik, bangers, marker, shippori, decorative, teko, silkscreen, versus].map((font) => font.variable).join(' ');
