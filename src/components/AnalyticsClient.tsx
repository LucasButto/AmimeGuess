'use client';

import { Analytics, type BeforeSend } from '@vercel/analytics/next';
import { NOTRACK_KEY, NOTRACK_PARAM, NOTRACK_SECRET } from './noTrack';

/** No envía el evento si este navegador está marcado o si la URL trae el valor secreto (la visita que lo marca). */
const beforeSend: BeforeSend = (event) => {
  try {
    if (typeof window !== 'undefined') {
      if (window.localStorage.getItem(NOTRACK_KEY)) return null;
      if (new URLSearchParams(window.location.search).get(NOTRACK_PARAM) === NOTRACK_SECRET) return null;
    }
  } catch {
    // Sin acceso a localStorage: se cuenta como cualquier visita.
  }
  return event;
};

/** `beforeSend` es una función: no se puede pasar desde el layout (servidor), por eso este envoltorio. */
export function AnalyticsClient() {
  return <Analytics beforeSend={beforeSend} />;
}
