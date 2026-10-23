// Piel de Pokémon (SPEC 9.2, sesión 15): retro de Game Boy Advance, en pixel art propio. Lo que no define
// acá (slots y datos) toma el valor por defecto; ver src/franchises/themes.ts.

import type { FranchiseSkin } from '../../types';
import { PokemonBackdrop } from './Backdrop';
import { BackNavBall } from './BackNavBall';
import { CardBack } from './CardBack';
import { CellBall } from './CellBall';
import { ChipBall } from './ChipBall';
import { DialogFooter } from './DialogFooter';
import { BallLoader, BattleIntro, BattleOutro, HpMeter, MetricIcon, StreakMedals, TypeMark } from './Extras';
import { PokemonModeCard, PokemonModeIcon } from './ModeCard';
import { PokedexFrame } from './PokedexFrame';
import { PokedexPicker } from './PokedexPicker';
import styles from './theme.module.scss';
import { PokemonWinCelebration } from './WinCelebration';

export const pokemonSkin: FranchiseSkin = {
  className: styles.root,
  // La bola se recoge en 250 ms antes de navegar (como máximo 300, SPEC 9.2).
  backNavExitMs: 250,
  // Al cambiar de modo, las barras se cierran en 400 ms y recién ahí se navega (la pantalla nueva las abre).
  pageExitMs: 400,
  // Celdas del Clásico con íconos pixel (✓, ~, ✗ y flechas).
  cellIcons: 'pixel',
  // El verde y el rojo ya lo dicen con el color: solo llevan ícono el parcial y las flechas.
  cellMarks: 'hints',
  // Los chips de las generaciones miden todos lo mismo.
  uniformFilterChips: true,
  // Las cartas aparecen de espaldas y se dan vuelta al quedar a la vista.
  imageBack: ['tcg-card'],
  // Al ganar, el resumen dice "¡Es X!".
  winHeadline: 'answer',
  // Al compartir: círculos en lugar de cuadrados (se distinguen por color y por forma de los de las otras
  // franquicias; entre sí, por color, como los cuadrados).
  shareEmojis: { correct: '🟢', partial: '🟡', incorrect: '🔴' },
  // Sonidos 8-bit originales (solo con "Sonidos" activo): un blip por celda que se da vuelta, un tono bajo
  // al fallar y una fanfarria corta de cuatro notas al ganar.
  sounds: {
    reveal: { wave: 'square', gain: 0.04, notes: [{ frequency: 988, duration: 45 }] },
    miss: {
      wave: 'triangle',
      gain: 0.08,
      notes: [
        { frequency: 196, duration: 110 },
        { frequency: 147, duration: 180 },
      ],
    },
    win: {
      wave: 'square',
      gain: 0.05,
      notes: [
        { frequency: 587, duration: 110 },
        { frequency: 740, duration: 110 },
        { frequency: 880, duration: 110 },
        { frequency: 1175, duration: 280 },
      ],
    },
  },
  slots: {
    Backdrop: PokemonBackdrop,
    GuessInput: PokedexPicker,
    BackNav: BackNavBall,
    ModeCard: PokemonModeCard,
    ModeIcon: PokemonModeIcon,
    Footer: DialogFooter,
    ChipMark: ChipBall,
    CellBack: CellBall,
    ImageBack: CardBack,
    ModeFrame: PokedexFrame,
    WinCelebration: PokemonWinCelebration,
    StreakDisplay: StreakMedals,
    AttemptsMeter: HpMeter,
    ValueMark: TypeMark,
    MetricMark: MetricIcon,
    PageTransition: BattleIntro,
    PageExit: BattleOutro,
    Loader: BallLoader,
  },
};
