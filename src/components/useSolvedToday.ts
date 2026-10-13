'use client';

import { useEffect, useState } from 'react';
import { getDay } from '@/engine/day';
import { getKeyedStorage, solvedToday, wonToday } from './progress';

/**
 * Los modos de la franquicia que ya se resolvieron hoy, o `null` mientras no se leyó el almacenamiento.
 * Se lee recién después de montar (el servidor no tiene `localStorage`) y se vuelve a leer al volver a la
 * pestaña, por si se jugó en otra, o al cruzar la medianoche.
 */
export function useSolvedToday(franchise: string, modes: readonly string[]): ReadonlySet<string> | null {
  return useTodayProgress(franchise, modes)?.solved ?? null;
}

export interface TodayProgress {
  /** Modos terminados hoy (ganados o perdidos). */
  readonly solved: ReadonlySet<string>;
  /** Intentos de los modos ganados hoy. */
  readonly attempts: ReadonlyMap<string, number>;
}

/** Como `useSolvedToday`, con los intentos de cada modo ganado hoy (para mostrar "Resuelto en N intentos"). */
export function useTodayProgress(franchise: string, modes: readonly string[]): TodayProgress | null {
  const [progress, setProgress] = useState<TodayProgress | null>(null);
  // Un arreglo nuevo en cada render no tiene que disparar la lectura: la identidad es el contenido.
  const modesKey = modes.join('|');

  useEffect(() => {
    const read = () => {
      const storage = getKeyedStorage();
      const list = modesKey.split('|');
      const day = getDay(new Date());
      setProgress({ solved: solvedToday(storage, franchise, list, day), attempts: wonToday(storage, franchise, list, day) });
    };
    read();
    document.addEventListener('visibilitychange', read);
    window.addEventListener('storage', read);
    return () => {
      document.removeEventListener('visibilitychange', read);
      window.removeEventListener('storage', read);
    };
  }, [franchise, modesKey]);

  return progress;
}
