// Los valores por defecto de una piel (SPEC 9.2): los componentes que dejó la sesión 14, sobrios o vacíos.
// Una franquicia sin piel, o una piel que no define un slot, usa estos y se ve con su tema base.

import type { BackNavIconProps, ChipMarkProps, ModeFrameProps, ResolvedSkin, SkinData, SkinSlots } from '@/franchises/types';
import { Autocomplete } from '../Autocomplete';
import { SHARE_MARKS } from '../game-shell/share';
import { SiteFooter } from '../SiteFooter';
import { DefaultModeCard } from './DefaultModeCard';
import styles from './defaults.module.scss';

const Nothing = () => null;

function DefaultModeFrame({ children }: ModeFrameProps) {
  return <>{children}</>;
}

/** Dorso de una celda del Clásico antes de revelarse: una tarjeta lisa con el color de los paneles hundidos. */
function DefaultCellBack() {
  return <span aria-hidden="true" className={styles.cellBack} />;
}

/** Marca de un chip de filtro: una tilde cuando la serie está activa (acompaña al color). */
function DefaultChipMark({ on }: ChipMarkProps) {
  return (
    <span aria-hidden="true" className={styles.chipMark}>
      {on ? '✓' : ''}
    </span>
  );
}

/** Dibujo de un botón de volver: una casa para el inicio y una flecha para la franquicia. */
function DefaultBackNav({ kind }: BackNavIconProps) {
  return (
    <svg className={styles.backIcon} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {kind === 'home' ? (
        <path d="M2 8 8 2.5 14 8M4 7v6.5h3V10h2v3.5h3V7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      ) : (
        <path d="M13 8H3.5M7.5 3.5 3 8l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

/** Indicador de carga: un anillo que gira (quieto con movimiento reducido). */
function DefaultLoader() {
  return <span aria-hidden="true" className={styles.loader} />;
}

export const DEFAULT_SLOTS: SkinSlots = {
  Backdrop: Nothing,
  GuessInput: Autocomplete,
  ModeCard: DefaultModeCard,
  ModeIcon: Nothing,
  TitleMark: Nothing,
  ModeFrame: DefaultModeFrame,
  Footer: SiteFooter,
  CellBack: DefaultCellBack,
  ImageBack: Nothing,
  ChipMark: DefaultChipMark,
  BackNav: DefaultBackNav,
  PageTransition: Nothing,
  PageExit: Nothing,
  Loader: DefaultLoader,
  StreakDisplay: Nothing,
  AttemptsMeter: Nothing,
  WinCelebration: Nothing,
  DailyReward: Nothing,
  ValueMark: Nothing,
  MetricMark: Nothing,
};

export const DEFAULT_SKIN_DATA: SkinData = {
  revealMode: 'flip',
  // Las marcas de siempre: el parcial es naranja, como la celda del Clásico.
  shareEmojis: SHARE_MARKS,
  sounds: {},
  backNavExitMs: 0,
  pageExitMs: 0,
  cellIcons: 'text',
  cellMarks: 'all',
  uniformFilterChips: false,
  imageBack: [],
  winHeadline: 'result',
};

export const DEFAULT_SKIN: ResolvedSkin = { ...DEFAULT_SKIN_DATA, className: null, slots: DEFAULT_SLOTS };
