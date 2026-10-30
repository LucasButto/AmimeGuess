'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { createDeparture } from './departure';

/** Al cambiar de ruta o desmontarse (también en Activity), no queda una salida vieja pendiente. */
export function useDeparture(pathname: string) {
  const [departure] = useState(createDeparture);
  const pending = useSyncExternalStore(departure.subscribe, departure.snapshot, departure.serverSnapshot);
  useEffect(() => {
    departure.arrive(pathname);
    return departure.cancel;
  }, [departure, pathname]);
  return { departure, pending: pending?.from === pathname ? pending : null };
}
