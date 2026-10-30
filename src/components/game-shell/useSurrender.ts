'use client';

import { useRef, useState } from 'react';
import { getLocalStorage, readState, writeState } from '@/engine/storage';
import type { FinishReport, GameSession } from './types';

/** Una derrota guardada también cierra partidas sin límite de intentos. */
export function useSurrender(session: GameSession) {
  const [lost, setLost] = useState(() => readState(getLocalStorage(), session)?.result === 'lost');
  const committed = useRef(lost);

  function surrender(attempts: readonly unknown[], report: FinishReport, draft?: unknown) {
    if (committed.current) return;
    committed.current = true;
    writeState(getLocalStorage(), session, { attempts: [...attempts], result: 'lost', draft });
    setLost(true);
    session.onFinish({ ...report, won: false, fresh: true });
  }

  return { lost, surrender };
}
