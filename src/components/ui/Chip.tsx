import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Chip.module.scss';

interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'aria-pressed'> {
  /** Prendido o apagado (`aria-pressed`). */
  pressed: boolean;
  /** No se puede cambiar ahora (por ejemplo, la última serie activa): se ve y se anuncia como bloqueado. */
  locked?: boolean;
  /** Marca antes del texto que dice el estado con la forma, no solo con el color (slot `ChipMark` del tema). */
  mark?: ReactNode;
  children: ReactNode;
}

/** Chip alternable genérico (SPEC 9.2): un botón con `aria-pressed`, re-vestible solo con tokens. */
export function Chip({ pressed, locked = false, mark, children, type = 'button', ...rest }: ChipProps) {
  return (
    <button type={type} className={styles.chip} aria-pressed={pressed} aria-disabled={locked || undefined} {...rest}>
      {mark}
      {children}
    </button>
  );
}
