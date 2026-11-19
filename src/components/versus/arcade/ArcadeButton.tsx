import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { ArcadeIcon } from './ArcadeIcon';
import type { ArcadeIconName } from './icons';
import styles from './ArcadeButton.module.scss';

type Tone = 'gold' | 'red' | 'blue';

interface CommonProps {
  /** Dorado: seleccionar y confirmar. Rojo: combate y revancha. Azul: acciones secundarias. */
  tone?: Tone;
  size?: 'md' | 'lg';
  icon?: ArcadeIconName;
  className?: string;
  children: ReactNode;
}

type ButtonProps = CommonProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> & { href?: undefined };
type LinkProps = CommonProps & { href: string; onClick?: () => void; 'aria-label'?: string };

/**
 * El botón de Retro Battle: paralelogramo con borde escalonado, brillo interior y sombra sólida. Sigue siendo un `<button>` (o un
 * `<Link>` con `href`) real: foco visible, `disabled` y etiqueta accesible. El ícono es decorativo.
 */
export function ArcadeButton(props: ButtonProps | LinkProps) {
  const { tone = 'gold', size = 'md', icon, className, children, ...rest } = props;
  const cls = className ? `${styles.button} ${className}` : styles.button;
  const content = (
    <>
      {icon && <ArcadeIcon name={icon} size={size === 'lg' ? 'lg' : 'md'} />}
      <span>{children}</span>
    </>
  );
  if ('href' in rest && rest.href !== undefined) {
    const { href, onClick, 'aria-label': label } = rest as Omit<LinkProps, keyof CommonProps>;
    return (
      <Link className={cls} data-tone={tone} data-size={size} href={href} {...(onClick ? { onClick } : {})} {...(label ? { 'aria-label': label } : {})}>
        {content}
      </Link>
    );
  }
  const { type = 'button', ...buttonProps } = rest as Omit<ButtonProps, keyof CommonProps>;
  return (
    <button className={cls} data-tone={tone} data-size={size} type={type} {...buttonProps}>
      {content}
    </button>
  );
}
