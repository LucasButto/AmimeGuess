'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useSolvedToday } from '@/components/useSolvedToday';
import { es } from '@/i18n/es';
import styles from './FranchiseCard.module.scss';

interface FranchiseCardProps {
  slug: string;
  name: string;
  /** Los modos que se pueden jugar (los ocultos por falta de contenido no cuentan). */
  modes: readonly string[];
}

/** Cartucho de una franquicia: conserva el conteo de modos jugables y progreso de hoy. */
export function FranchiseCard({ slug, name, modes }: FranchiseCardProps) {
  const router = useRouter();
  const [inserting, setInserting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current !== null) clearTimeout(timer.current); }, []);
  const solved = useSolvedToday(slug, modes);
  const done = solved !== null && modes.length > 0 && solved.size === modes.length;

  return (
    // `data-franchise` le da a la tarjeta las variables de su tema (ver `themeCss` con alcance de franquicia).
    <Link className={styles.card} href={`/${slug}`} data-franchise={slug} data-cartridge data-inserting={inserting}
      data-progress-ready={solved !== null}
      aria-label={solved === null ? es.home.cardLoading(name) : es.home.cardLabel(name, solved.size, modes.length)}
      onNavigate={(event) => {
        // Los clics modificados conservan el enlace nativo y no pasan por onNavigate.
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        event.preventDefault();
        if (timer.current !== null) return;
        setInserting(true);
        timer.current = setTimeout(() => router.push(`/${slug}`), 180);
      }}>
      <span className={styles.glow} aria-hidden="true" />
      <span className={styles.shell} data-cartridge-body>
        <span className={styles.grip} aria-hidden="true" />
        <span className={styles.label} data-cartridge-label>
          <span className={styles.name}>{name}</span>
          <span className={styles.seal} aria-hidden="true" />
        </span>
        {/* El renglón reserva su alto mientras se lee el progreso. */}
        <span className={styles.progress} data-done={done}>
          <span className={styles.light} aria-hidden="true" />
          {solved === null ? es.home.loading : es.home.progress(solved.size, modes.length)}
        </span>
        <span className={styles.contacts} aria-hidden="true" />
      </span>
      <span className={styles.slot} aria-hidden="true" />
    </Link>
  );
}
