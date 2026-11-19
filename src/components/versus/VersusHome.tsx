'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { es } from '@/i18n/es';
import { isRoomCode } from '@/versus/code';
import { ArcadeButton } from './arcade/ArcadeButton';
import { ArcadeIcon } from './arcade/ArcadeIcon';
import { ArcadePanel } from './arcade/ArcadePanel';
import styles from './VersusHome.module.scss';

const copy = es.versus.home;

/** Las tres modalidades de la portada, cada una en su recuadro. */
const MODES = [
  { key: 'timeAttack', icon: 'stopwatch' },
  { key: 'race', icon: 'checkered-flag' },
  { key: 'fewestAttempts', icon: 'crown-gold' },
] as const;

/** La portada de Versus: dos acciones (crear una sala o unirse con su código) y la franja de modalidades. */
export function VersusHome() {
  const router = useRouter();
  const inputId = useId();
  const hintId = useId();
  const [code, setCode] = useState('');
  const [touched, setTouched] = useState(false);
  const normalized = code.trim().toUpperCase();
  const valid = isRoomCode(normalized);
  const invalid = touched && !valid;

  function join() {
    setTouched(true);
    if (valid) router.push(`/versus/sala?c=${normalized}`);
  }

  return (
    <div className={styles.root}>
      <div className={styles.actions}>
        <ArcadePanel as="section" tone="red" big aria-labelledby={`${inputId}-create`} className={styles.create}>
          <ArcadeButton href="/versus/crear" size="lg" icon="players-group" className={styles.createButton}>
            <span id={`${inputId}-create`}>{copy.create}</span>
          </ArcadeButton>
          <p className={styles.hint}>{copy.createHint}</p>
        </ArcadePanel>

        <ArcadePanel as="form" big className={styles.join} aria-labelledby={`${inputId}-join`}>
          <h2 className={styles.joinTitle} id={`${inputId}-join`}>
            <ArcadeIcon name="enter" size="lg" /> {copy.join}
          </h2>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={inputId}>{copy.codeLabel}</label>
            <div className={styles.row}>
              <input
                id={inputId}
                className={styles.input}
                value={code}
                maxLength={6}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder={copy.codePlaceholder}
                aria-invalid={invalid || undefined}
                aria-describedby={invalid ? hintId : undefined}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                onBlur={() => code !== '' && setTouched(true)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    join();
                  }
                }}
              />
              <ArcadeButton onClick={join}>{copy.joinButton}</ArcadeButton>
            </div>
            <p className={styles.error} id={hintId} role="status">{invalid ? copy.invalidCode : ''}</p>
          </div>
        </ArcadePanel>
      </div>

      <section aria-labelledby={`${inputId}-modes`}>
        <h2 className={styles.srOnly} id={`${inputId}-modes`}>{copy.modes}</h2>
        <ul className={styles.modes}>
          {MODES.map((mode) => (
            <li key={mode.key}>
              <ArcadePanel as="div" className={styles.mode}>
                <ArcadeIcon name={mode.icon} size="xl" />
                <span className={styles.modeText}>
                  <strong>{es.versus.modality[mode.key]}</strong>
                  {copy[mode.key]}
                </span>
              </ArcadePanel>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
