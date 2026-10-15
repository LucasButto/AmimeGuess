import { Chip } from '@/components/ui/Chip';
import { es } from '@/i18n/es';
import styles from './LevelPicker.module.scss';
import type { TimelineLevel } from './types';

interface LevelPickerProps {
  levels: readonly TimelineLevel[];
  /** La dificultad elegida (desde 0). */
  selected: number;
  /** Cuántos sucesos hay con los filtros activos: una dificultad que pide más no se puede elegir. */
  available: number;
  onSelect: (index: number) => void;
}

const nameOf = (index: number): string => es.timeline.levelNames[index] ?? es.timeline.level(index + 1);

/**
 * Selector de dificultad de la línea de tiempo: un botón por dificultad ("Fácil · 5 sucesos"), con el elegido prendido. Si con los filtros de ahora no alcanzan los sucesos de alguna dificultad, queda bloqueada y un aviso dice cuántos hacen
 * falta. Va arriba del juego y no se vuelve a montar al cambiar: el foco queda donde estaba.
 */
export function LevelPicker({ levels, selected, available, onSelect }: LevelPickerProps) {
  const locked = levels.map((level, index) => ({ level, index })).filter(({ level }) => available < level.count);
  return (
    <div className={styles.root}>
      <div className={styles.row}>
        <div className={styles.levels} role="group" aria-label={es.timeline.levelsLabel}>
          <span className={styles.title}>{es.timeline.levelsLabel}</span>
          <ul className={styles.list}>
            {levels.map((level, index) => {
              const enough = available >= level.count;
              return (
                <li key={level.count}>
                  <Chip pressed={index === selected} locked={!enough} onClick={() => enough && onSelect(index)}>
                    {nameOf(index)}
                    <span className={styles.detail}>{es.timeline.levelCount(level.count)}</span>
                  </Chip>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      {locked.length > 0 && (
        <p className={styles.warning} role="status">
          {locked.map(({ level, index }) => es.timeline.levelLocked(nameOf(index), level.count, available)).join(' ')}
        </p>
      )}
    </div>
  );
}
