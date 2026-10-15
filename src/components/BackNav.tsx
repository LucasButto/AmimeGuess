'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { es } from '@/i18n/es';
import styles from './BackNav.module.scss';
import { useSkin } from './skin/context';
import { TitleWords } from './TitleWords';

interface BackNavProps {
  franchise: { slug: string; name: string };
  /** `true` en la página de la franquicia: ahí no se muestra su botón, porque llevaría a esa misma página. */
  atFranchise?: boolean;
}

type Kind = 'home' | 'franchise';

/**
 * Los botones de volver (SPEC 9.2): "Inicio" y la franquicia, siempre en la misma posición y con la misma
 * caja, para no desorientar a quien pasa de una página a otra. La franquicia solo aparece dentro de un modo
 * de juego (en su propia página no hace falta: llevaría a donde ya se está). El
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
    { kind: 'home' as const, href: '/', label: es.nav.home },
    ...(atFranchise ? [] : [{ kind: 'franchise' as const, href: `/${franchise.slug}`, label: franchise.name }]),
  ];

  function handleClick(event: MouseEvent<HTMLAnchorElement>, kind: Kind, href: string) {
    const delay = skin.backNavExitMs;
    const plain = event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
    if (delay <= 0 || !plain || leaving !== null) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    event.preventDefault();
    setLeaving(kind);
    timer.current = setTimeout(() => router.push(href), delay);
  }

  return (
    <nav className={styles.nav} aria-label={es.nav.label} data-leaving={leaving ?? undefined}>
      <ul className={styles.list}>
        {links.map(({ kind, href, label }) => (
          <li key={kind}>
            <Link
              className={styles.link}
              href={href}
              data-kind={kind}
              onClick={(event) => handleClick(event, kind, href)}
            >
              <span className={styles.icon}>
                <Icon kind={kind} leaving={leaving === kind} />
              </span>
              <span className={styles.label}>
                <TitleWords text={label} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
