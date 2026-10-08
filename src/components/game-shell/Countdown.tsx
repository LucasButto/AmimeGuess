'use client';

import { useEffect, useState } from 'react';
import { msUntilNextDay } from '@/engine/day';
import { es } from '@/i18n/es';
import styles from './Countdown.module.scss';
import { formatCountdown, toIsoDuration } from './format';

/** Cuenta regresiva hasta el próximo reto, que se reinicia a las 00:00 de Argentina (SPEC 5). */
export function Countdown() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const remaining = msUntilNextDay(now);

  return (
    <p className={styles.root}>
      <span className={styles.label}>{es.shell.nextChallenge}</span>{' '}
      {/* role="timer" no anuncia cada segundo: se lee solo cuando la persona se detiene en él. */}
      <time className={styles.time} role="timer" dateTime={toIsoDuration(remaining)}>
        {formatCountdown(remaining)}
      </time>
    </p>
  );
}
