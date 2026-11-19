'use client';

import { useEffect } from 'react';
import { es } from '@/i18n/es';
import { NOTRACK_KEY, NOTRACK_PARAM, NOTRACK_SECRET } from './noTrack';

/** Con `?notrack=<secreto>` marca este navegador para que no cuente en Analytics; con `?notrack=off` lo desmarca. No dibuja nada. */
export function NoTrackFlag() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const value = params.get(NOTRACK_PARAM);
      if (value === null) return;
      if (value === NOTRACK_SECRET) {
        window.localStorage.setItem(NOTRACK_KEY, '1');
        window.alert(es.noTrack.on);
      } else if (value === 'off') {
        window.localStorage.removeItem(NOTRACK_KEY);
        window.alert(es.noTrack.off);
      }
      params.delete(NOTRACK_PARAM);
      const query = params.toString();
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
    } catch {
      // Sin localStorage o sin history: no se hace nada.
    }
  }, []);
  return null;
}
