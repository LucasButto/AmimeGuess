import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.scss';
import { PixelIcon } from './icons';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'icon';

interface Look {
  /** `primary`: la acción principal; `secondary`: una alternativa; `ghost`: acciones de barra; `icon`: solo un ícono. */
  variant?: ButtonVariant;
  /** Solo para `icon`: tono A (enviar, confirmar) o tono B (cerrar, volver). */
  tone?: 'a' | 'b';
  /** Clases de ubicación (márgenes, flex) de quien lo usa; el aspecto lo dan la variante y los tokens. */
  className?: string;
}

interface ButtonProps extends Look, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  children: ReactNode;
}

function classOf(className: string | undefined) {
  return className ? `${styles.button} ${className}` : styles.button;
}

/** Lo que va adentro: las decoraciones opcionales de la variante (las muestra o no el tema) y el texto. */
function Content({ variant, children }: { variant: ButtonVariant; children: ReactNode }) {
  return (
    <>
      {variant === 'primary' && <span aria-hidden="true" className={styles.lead} />}
      {variant === 'ghost' && <PixelIcon name="cursor" className={styles.cursor} />}
      {children}
    </>
  );
}

/**
 * Botón genérico (SPEC 9.2): área táctil de 44 px, anillo de foco visible y el aspecto del tema, que lo
 * re-viste solo con tokens (relleno, borde, recorte de las esquinas, decoraciones). No conoce franquicias.
 */
export function Button({ variant = 'primary', tone = 'a', className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button className={classOf(className)} data-variant={variant} data-tone={variant === 'icon' ? tone : undefined} type={type} {...rest}>
      <Content variant={variant}>{children}</Content>
    </button>
  );
}

/** Un link que se ve como un botón (para ir a otra página). */
export function ButtonLink({ variant = 'primary', tone = 'a', className, href, children }: Look & { href: string; children: ReactNode }) {
  return (
    <Link className={classOf(className)} data-variant={variant} data-tone={variant === 'icon' ? tone : undefined} href={href}>
      <Content variant={variant}>{children}</Content>
    </Link>
  );
}
