import type { ElementType, ReactNode } from 'react';
import styles from './ArcadePanel.module.scss';

interface ArcadePanelProps {
  /** El rótulo de la pestaña inclinada de arriba ("Partidas", "Tu apodo"). Sin él, el panel no lleva pestaña. */
  title?: string;
  /** Algo a la derecha de la pestaña ("0 de 10 partidas"). */
  aside?: ReactNode;
  /** Resaltado (dorado) en vez de azul. */
  selected?: boolean;
  /** El color del panel: azul (el de siempre) o rojo (la acción principal de la portada). */
  tone?: 'blue' | 'red';
  /** Esquinas con escalones grandes (las tarjetas de la portada). */
  big?: boolean;
  as?: ElementType;
  className?: string;
  id?: string;
  'aria-labelledby'?: string;
  children: ReactNode;
}

/** El panel de Retro Battle: azul oscuro opaco, borde escalonado, bisel cian y sombra sólida, con pestaña de título opcional. */
export function ArcadePanel({ title, aside, selected = false, tone = 'blue', big = false, as: Tag = 'section', className, children, ...rest }: ArcadePanelProps) {
  const cls = className ? `${styles.panel} ${className}` : styles.panel;
  return (
    <Tag className={cls} data-selected={selected || undefined} data-tone={tone} data-big={big || undefined} {...rest}>
      {(title !== undefined || aside !== undefined) && (
        <header className={styles.head}>
          {title !== undefined && <h2 className={styles.tab}>{title}</h2>}
          {aside !== undefined && <div className={styles.aside}>{aside}</div>}
        </header>
      )}
      <div className={styles.body}>{children}</div>
    </Tag>
  );
}
