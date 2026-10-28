import type { FranchiseSkin } from '../../types';
import { es } from '@/i18n/es';
import styles from './theme.module.scss';
import { DuelBackdrop } from './Backdrop';
import { DeckNav } from './DeckNav';
import { CardEntrance } from './PageTransition';
import { ShuffleLoader } from './Loader';
import { DuelModeCard } from './ModeCard';
import { FieldControls } from './FieldControls';
import { ScarabStreak } from './StreakDisplay';
import { CardFooter } from './Footer';
import { CardChipMark } from './ChipMark';
import games from './Games.module.scss';
import { LifePoints } from './LifePoints';
import { DuelCellBack, DuelImageBack, DuelFrame, ClassMark, DuelMetric } from './GameMarks';
import { DuelVictory } from './Victory';
import { DuelDiskInput } from './DuelDiskInput';
import { CardTitleMark } from './TitleMark';
import { AnimeChainItem, AnimeComparisonMedia } from './AnimeGameCards';

export const yugiohSkin: FranchiseSkin = {
  className: `${styles.root} ${games.root}`,
  revealMode: 'flip',
  customComparisonMedia: true,
  customRevealListItems: true,
  additionalAttemptsMeters: ['image-reveal', 'text-clue', 'reveal-list', 'higher-lower'],
  revealListPositionPrefix: es.yugiohGames.chainPrefix,
  celebrateScoredResults: true,
  imageBack: ['ace-card'],
  shareEmojis: { correct: '🟩', partial: '🟨', incorrect: '🟥' },
  sounds: {
    reveal: { wave: 'triangle', gain: 0.035, notes: [{ frequency: 740, duration: 35 }, { frequency: 370, duration: 65 }] },
    miss: { wave: 'triangle', gain: 0.08, notes: [{ frequency: 110, duration: 80 }, { frequency: 55, duration: 160 }] },
    win: { wave: 'triangle', gain: 0.06, notes: [{ frequency: 392, duration: 90 }, { frequency: 494, duration: 90 }, { frequency: 587, duration: 90 }, { frequency: 784, duration: 270 }] },
  },
  backNavExitMs: 240,
  pageExitMs: 0,
  uniformFilterChips: true,
  cellMarks: 'arrows',
  slots: {
    ComparisonMedia: AnimeComparisonMedia,
    RevealListItem: AnimeChainItem,
    TitleMark: CardTitleMark,
    GuessInput: DuelDiskInput,
    ModeFrame: DuelFrame,
    AttemptsMeter: LifePoints,
    CellBack: DuelCellBack,
    ImageBack: DuelImageBack,
    ValueMark: ClassMark,
    MetricMark: DuelMetric,
    WinCelebration: DuelVictory,
    Backdrop: DuelBackdrop,
    BackNav: DeckNav,
    PageTransition: CardEntrance,
    Loader: ShuffleLoader,
    ModeCard: DuelModeCard,
    DailyReward: FieldControls,
    StreakDisplay: ScarabStreak,
    Footer: CardFooter,
    ChipMark: CardChipMark,
  },
};
