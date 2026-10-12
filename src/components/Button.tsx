import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.scss';

type Variant = 'primary' | 'secondary';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: Variant;
  children: ReactNode;
}

/** Botón común: área táctil de 44 px, contorno de foco visible y los colores del tema. */
export function Button({ variant = 'primary', children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button className={styles.button} data-variant={variant} type={type} {...rest}>
      {children}
    </button>
  );
}

/** Un link que se ve como el botón común (para ir a otra página). */
export function ButtonLink({ variant = 'primary', href, children }: { variant?: Variant; href: string; children: ReactNode }) {
  return (
    <Link className={styles.button} data-variant={variant} href={href}>
      {children}
    </Link>
  );
}
