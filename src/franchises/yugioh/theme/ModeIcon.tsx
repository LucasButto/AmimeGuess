import type { EgyptianIconKind } from './modeCards';
import styles from './ModeIcon.module.scss';

/** El objeto de la hoja de íconos de Yu-Gi-Oh (`public/icons/yugioh/<nombre>.webp`) que ilustra la carta de cada modo. */
const files: Record<EgyptianIconKind, string> = {
  duelist: 'puzzle-del-milenio',
  card: 'carta-monstruo',
  shadow: 'dragon-negro-ojos-rojos',
  scroll: 'libro-magico',
  brush: 'tablilla',
  cartouche: 'dragon-blanco-ojos-azules',
  eye: 'ojo-del-milenio',
  balance: 'balanza-del-milenio',
  summon: 'remolino',
  deck: 'mazo',
  timeline: 'mago-del-tiempo',
};

export function EgyptianModeIcon({ kind }: { kind: EgyptianIconKind }) {
  return <img className={styles.icon} src={`/icons/yugioh/${files[kind]}.webp`} alt="" width={200} height={200} draggable={false} aria-hidden="true" />;
}
