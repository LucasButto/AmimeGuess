import type { ComponentProps } from 'react';
import styles from './VisuallyHidden.module.scss';

/** Texto que solo leen los lectores de pantalla: etiquetas, resultados de una celda, avisos en vivo. */
export function VisuallyHidden({ className, ...props }: ComponentProps<'span'>) {
  return <span {...props} className={className ? `${styles.root} ${className}` : styles.root} />;
}
