import type { HTMLAttributes, ReactNode, Ref } from 'react';
import styles from './Panel.module.scss';

type PanelElement = 'div' | 'section' | 'aside' | 'footer' | 'header';

interface PanelProps extends HTMLAttributes<HTMLElement> {
  /**
   * `plain`: un panel de contenido; `dialog`: un cuadro de diálogo (en los temas de consola, con marco
   * doble); `screen`: una pantalla oscura con texto claro.
   */
  variant?: 'plain' | 'dialog' | 'screen';
  as?: PanelElement;
  ref?: Ref<HTMLElement>;
  children: ReactNode;
}

/**
 * Panel genérico (SPEC 9.2): el fondo y el marco de un bloque de contenido, re-vestibles solo con tokens. El
 * relleno interior suma el grosor del marco; quien lo usa lo ajusta con `--panel-pad` en su clase, y el
 * redondeo de las esquinas (cuando el tema no las recorta) con `--panel-radius`.
 */
export function Panel({ variant = 'plain', as: Element = 'div', className, children, ref, ...rest }: PanelProps) {
  return (
    // Cualquiera de los elementos posibles es un HTMLElement: la ref vale para todos.
    <Element ref={ref as Ref<HTMLDivElement>} className={className ? `${styles.panel} ${className}` : styles.panel} data-variant={variant} {...rest}>
      {children}
    </Element>
  );
}
