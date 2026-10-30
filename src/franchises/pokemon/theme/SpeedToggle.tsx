'use client';

import { pokemonSpeedTestEnabled } from '@/franchises/visibility';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { getWalkerSpeed, setWalkerSpeed } from './walkerSpeed';
import styles from './SpeedToggle.module.scss';

const SPEEDS = [0.5, 1, 2, 3] as const;

/** Botones de prueba (activados en data/mode.json): aceleran caminantes y animaciones para cazar errores. */
export function WalkerSpeedToggle() {
  const [value, setValue] = useState(getWalkerSpeed);
  if (!pokemonSpeedTestEnabled || typeof document === 'undefined') return null;
  return createPortal(
    <div className={styles.toggle} data-pmd-speed="">
      {SPEEDS.map((speed) => (
        <button key={speed} type="button" className={styles.button} aria-pressed={value === speed}
          onClick={() => { setValue(speed); setWalkerSpeed(speed); }}>
          ×{speed}
        </button>
      ))}
    </div>,
    document.body,
  );
}
