'use client';

import { useEffect, useState } from 'react';
import { getDay } from '@/engine/day';
import { getKeyedStorage, solvedToday } from './progress';

/**
 * Los modos de la franquicia que ya se resolvieron hoy, o `null` mientras no se leyó el almacenamiento.
 * Se lee recién después de montar (el servidor no tiene `localStorage`) y se vuelve a leer al volver a la
 * pestaña, por si se jugó en otra, o al cruzar la medianoche.
 */
export function useSolvedToday(franchise: string, modes: readonly string[]): ReadonlySet<string> | null {
  const [solved, setSolved] = useState<ReadonlySet<string> | null>(null);
  // Un arreglo nuevo en cada render no tiene que disparar la lectura: la identidad es el contenido.
  const modesKey = modes.join('|');

  useEffect(() => {
    const read = () => setSolved(solvedToday(getKeyedStorage(), franchise, modesKey.split('|'), getDay(new Date())));
    read();
    document.addEventListener('visibilitychange', read);
    window.addEventListener('storage', read);
    return () => {
      document.removeEventListener('visibilitychange', read);
      window.removeEventListener('storage', read);
    };
  }, [franchise, modesKey]);

  return solved;
}
