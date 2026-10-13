'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { es } from '@/i18n/es';
import styles from './BackNav.module.scss';
import { useSkin } from './skin/context';

interface BackNavProps {
  franchise: { slug: string; name: string };
  /** `true` en la página de la franquicia: su botón apunta a la página actual. */
  atFranchise?: boolean;
}

type Kind = 'home' | 'franchise';

/**
 * Los botones de volver (SPEC 9.2): "Inicio" y la franquicia, siempre en la misma posición y con la misma
 * caja en todas las páginas de franquicia y de modo, para no desorientar a quien pasa de una a otra. El
 * tema solo cambia el dibujo (slot `BackNav`) y, si quiere, una animación de salida de 300 ms o menos
 * antes de navegar; con movimiento reducido o un clic con modificadores navega enseguida.
 */
export function BackNav({ franchise, atFranchise = false }: BackNavProps) {
  const { skin } = useSkin();
  const Icon = skin.slots.BackNav;
  const router = useRouter();
  const [leaving, setLeaving] = useState<Kind | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const links = [
    { kind: 'home' as const, href: '/', label: es.nav.home, current: false },
    { kind: 'franchise' as const, href: `/${franchise.slug}`, label: franchise.name, current: atFranchise },
  ];

  function handleClick(event: MouseEvent<HTMLAnchorElement>, kind: Kind, href: string, current: boolean) {
    const delay = skin.backNavExitMs;
    const plain = event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
    // Sin animación si el link es la página actual: no hay a dónde ir.
    if (delay <= 0 || !plain || current || leaving !== null) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    event.preventDefault();
    setLeaving(kind);
    timer.current = setTimeout(() => router.push(href), delay);
  }

  return (
    <nav className={styles.nav} aria-label={es.nav.label} data-leaving={leaving ?? undefined}>
      <ul className={styles.list}>
        {links.map(({ kind, href, label, current }) => (
          <li key={kind}>
            <Link
              className={styles.link}
              href={href}
              aria-current={current ? 'page' : undefined}
              data-kind={kind}
              onClick={(event) => handleClick(event, kind, href, current)}
            >
              <span className={styles.icon}>
                <Icon kind={kind} leaving={leaving === kind} />
              </span>
              <span className={styles.label}>{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
