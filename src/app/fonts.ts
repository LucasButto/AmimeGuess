import { Bangers, Cinzel, Jersey_10, Kaushan_Script, Press_Start_2P, Rubik } from 'next/font/google';

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
const kaushan = Kaushan_Script({ weight: '400', subsets: ['latin'], display: 'swap', preload: false, variable: '--font-kaushan-script' });
const cinzel = Cinzel({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-cinzel' });

/** Clases que declaran las variables `--font-*`: van en `<html>`, así cualquier tema las puede usar. */
export const fontVariables = [pressStart, jersey, rubik, bangers, kaushan, cinzel].map((font) => font.variable).join(' ');
