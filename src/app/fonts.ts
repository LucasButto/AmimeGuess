import { Bangers, Cinzel, Fredoka, Kaushan_Script } from 'next/font/google';

// Tipografías de títulos de los temas (SPEC 9; una por franquicia). `next/font` las baja una sola vez en el
// build y las sirve desde el propio sitio como archivos estáticos: no se pide nada a Google en producción.
// `preload: false` hace que cada visita descargue solo la que usa: el CSS de las cuatro está siempre, pero el
// navegador baja una fuente recién cuando algo la necesita.
// Las opciones van escritas a mano en cada llamada: `next/font` las lee al compilar y no admite valores compartidos.
// Cada variable CSS (`--font-*`) coincide con un id de `ThemeFont` en src/franchises/types.ts.
const fredoka = Fredoka({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-fredoka' });
const bangers = Bangers({ weight: '400', subsets: ['latin'], display: 'swap', preload: false, variable: '--font-bangers' });
const kaushan = Kaushan_Script({ weight: '400', subsets: ['latin'], display: 'swap', preload: false, variable: '--font-kaushan-script' });
const cinzel = Cinzel({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-cinzel' });

/** Clases que declaran las variables `--font-*`: van en `<html>`, así cualquier tema las puede usar. */
export const fontVariables = [fredoka, bangers, kaushan, cinzel].map((font) => font.variable).join(' ');
