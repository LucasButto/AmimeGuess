'use client';

import { useEffect, useState } from 'react';
import { getDay } from '@/engine/day';
import { getLocalStorage } from '@/engine/storage';
import { getKeyedStorage, lostToday, siteTotals, solvedToday, streaksOf, winDays, wonToday, type SiteTotals } from './progress';
import type { TodayProgress } from './useSolvedToday';

/** Una franquicia con los modos que se pueden jugar (los que cuentan para el progreso de hoy). */
export interface ProgressTarget {
  readonly slug: string;
  readonly modes: readonly string[];
}

/** Vuelve a leer el almacenamiento al volver a la pestaña o cuando otra pestaña lo cambia; `null` hasta la primera lectura. */
function useStorageRead<T>(read: () => T, key: string): T | null {
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => {
    const update = () => setValue(read());
    update();
    document.addEventListener('visibilitychange', update);
    window.addEventListener('storage', update);
    return () => {
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('storage', update);
    };
    // `key` es la identidad del contenido de `read`: una función nueva en cada render no tiene que disparar la lectura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return value;
}

const keyOf = (targets: readonly ProgressTarget[]) => targets.map(({ slug, modes }) => `${slug}:${modes.join(',')}`).join('|');

/** El progreso de hoy de varias franquicias a la vez (el inicio y la pestaña Retos), por franquicia. */
export function useSiteProgress(targets: readonly ProgressTarget[]): ReadonlyMap<string, TodayProgress> | null {
  return useStorageRead(() => {
    const storage = getKeyedStorage();
    const day = getDay(new Date());
    return new Map(
      targets.map(({ slug, modes }): [string, TodayProgress] => [
        slug,
        { solved: solvedToday(storage, slug, modes, day), attempts: wonToday(storage, slug, modes, day), lost: lostToday(storage, slug, modes, day) },
      ]),
    );
  }, keyOf(targets));
}

export interface SiteStats {
  readonly totals: SiteTotals;
  /** Racha vigente de todo el sitio: días seguidos con al menos un reto ganado. */
  readonly streak: number;
  readonly bestStreak: number;
}

/** La racha global y los totales de todo el sitio (la pestaña Estadísticas y la racha del inicio). */
export function useSiteStats(targets: readonly ProgressTarget[]): SiteStats | null {
  return useStorageRead(() => {
    const { current, best } = streaksOf(winDays(getKeyedStorage()), getDay(new Date()));
    return { totals: siteTotals(getLocalStorage(), targets), streak: current, bestStreak: best };
  }, keyOf(targets));
}
