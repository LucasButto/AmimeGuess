// Piel de Naruto (SPEC 9.2, sesión 17): pergamino, tinta y mundo ninja. Lo que no define acá (slots y datos) toma el
// valor por defecto; ver src/franchises/themes.ts. Se va completando por fases: tokens y tipografía primero, después la
// escena, las tarjetas de modo, el pie y los juegos.

import type { FranchiseSkin } from '../../types';
import { BingoBookInput } from './BingoBook';
import { NarutoBackdrop } from './Backdrop';
import { ChakraMeter, RamenStreak } from './Extras';
import { MetalPlate, ScrollFooter } from './Footer';
import { NinjaBackNav, ShurikenLoader, SmokeIn } from './Ninja';
import { NatureMarks } from './Natures';
import { MissionStamp, SmokeBack } from './Substitution';
import games from './Games.module.scss';
import { NarutoModeCard, NarutoModeIcon, NarutoTitleMark } from './Scroll';
import styles from './theme.module.scss';

export const narutoSkin: FranchiseSkin = {
  className: `${styles.root} ${games.root}`,
  // El kunai sale disparado (o el humo tapa el de teletransporte) en 250 ms antes de navegar (como mucho 300, SPEC 9.2).
  backNavExitMs: 250,
  // Sin tildes, cruces ni el símbolo del parcial: el verde, el naranja y el rojo lo dicen solos; solo quedan las flechas.
  cellMarks: 'arrows',
  // El Clásico se revela con la técnica de sustitución: cada celda es una nube de humo con un tronco que sale volando.
  revealMode: 'swap',
  // Al compartir: 🍥 el acierto, 🍃 el parcial y 🌫️ el error (se distinguen por forma y por color).
  shareEmojis: { correct: '🍥', partial: '🍃', incorrect: '🌫️' },
  // Sonidos sintetizados originales (solo con "Sonidos" activo): un "puf" de humo corto por cada celda, un kunai que se clava
  // al fallar y un gong corto al ganar.
  sounds: {
    reveal: { wave: 'triangle', gain: 0.04, notes: [{ frequency: 220, duration: 30 }, { frequency: 150, duration: 50 }] },
    miss: { wave: 'square', gain: 0.05, notes: [{ frequency: 880, duration: 25 }, { frequency: 140, duration: 120 }] },
    win: {
      wave: 'sine',
      gain: 0.09,
      notes: [
        { frequency: 196, duration: 120 },
        { frequency: 147, duration: 600 },
      ],
    },
  },
  slots: {
    Backdrop: NarutoBackdrop,
    GuessInput: BingoBookInput,
    BackNav: NinjaBackNav,
    PageTransition: SmokeIn,
    Loader: ShurikenLoader,
    ModeCard: NarutoModeCard,
    ModeIcon: NarutoModeIcon,
    TitleMark: NarutoTitleMark,
    StreakDisplay: RamenStreak,
    AttemptsMeter: ChakraMeter,
    CellBack: SmokeBack,
    WinCelebration: MissionStamp,
    ValueMark: NatureMarks,
    Footer: ScrollFooter,
    ChipMark: MetalPlate,
  },
};
