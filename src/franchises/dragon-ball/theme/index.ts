// Piel de Dragon Ball (SPEC 9.2, sesión 16): manga de acción. Lo que no define acá (slots y datos) toma el valor
// por defecto; ver src/franchises/themes.ts. Se va completando por fases: tokens y tipografía primero, después la
// escena, las tarjetas de modo, el pie y los juegos.

import type { FranchiseSkin } from '../../types';
import { DragonBallBackdrop } from './Backdrop';
import { ChipSphere } from './ChipSphere';
import { DragonBackNav } from './BackNavIcons';
import { KiMeter } from './Extras';
import { DragonLoader } from './Loader';
import { MangaFooter } from './MangaFooter';
import { DragonModeCard, DragonModeIcon, DragonTitleMark } from './ModeCard';
import { DragonReward } from './Reward';
import { Onomatopoeia, ScouterBack } from './Scan';
import { ScouterInput } from './ScouterInput';
import { ShenlongIn, ShenlongOut } from './Shenlong';
import { GoldenAura, ScouterIcon } from './Win';
import games from './Games.module.scss';
import styles from './theme.module.scss';

export const dragonBallSkin: FranchiseSkin = {
  className: `${styles.root} ${games.root}`,
  // La nube se disipa en 250 ms antes de navegar (como máximo 300, SPEC 9.2).
  backNavExitMs: 250,
  // Al cambiar de modo, el resplandor dorado tapa la pantalla mientras Shenlong cruza de izquierda a derecha hasta el medio
  // (900 ms) y recién ahí se navega; la pantalla nueva sigue el vuelo otros 900 ms (1,8 s en total).
  pageExitMs: 900,
  // Sin tildes, cruces ni el símbolo del parcial: el verde, el amarillo y el rojo lo dicen solos; solo quedan las flechas de
  // mayor y menor.
  cellMarks: 'arrows',
  // El Clásico se revela con un escaneo del scouter y una onomatopeya: la cara aparece debajo del dorso.
  revealMode: 'swap',
  // Al compartir: naranja el acierto, amarillo el parcial y negro el error (se distinguen por color y por brillo).
  shareEmojis: { correct: '🟠', partial: '🟡', incorrect: '⚫' },
  // Sonidos sintetizados originales (solo con "Sonidos" activo): una carga de ki que sube por cada celda, un golpe grave
  // al fallar y una fanfarria corta y brillante al ganar.
  sounds: {
    reveal: { wave: 'sawtooth', gain: 0.03, notes: [{ frequency: 330, duration: 40 }, { frequency: 520, duration: 60 }] },
    miss: { wave: 'triangle', gain: 0.09, notes: [{ frequency: 130, duration: 90 }, { frequency: 82, duration: 200 }] },
    win: {
      wave: 'square',
      gain: 0.05,
      notes: [
        { frequency: 392, duration: 90 },
        { frequency: 523, duration: 90 },
        { frequency: 659, duration: 90 },
        { frequency: 784, duration: 90 },
        { frequency: 1047, duration: 300 },
      ],
    },
  },
  slots: {
    Backdrop: DragonBallBackdrop,
    GuessInput: ScouterInput,
    BackNav: DragonBackNav,
    PageTransition: ShenlongIn,
    PageExit: ShenlongOut,
    Loader: DragonLoader,
    ModeCard: DragonModeCard,
    ModeIcon: DragonModeIcon,
    TitleMark: DragonTitleMark,
    DailyReward: DragonReward,
    Footer: MangaFooter,
    ChipMark: ChipSphere,
    CellBack: ScouterBack,
    ValueMark: Onomatopoeia,
    WinCelebration: GoldenAura,
    MetricMark: ScouterIcon,
    AttemptsMeter: KiMeter,
  },
};
