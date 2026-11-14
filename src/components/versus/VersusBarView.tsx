'use client';

import type { CSSProperties } from 'react';
import type { VersusBarProps } from '@/franchises/types';
import { ArcadeIcon } from './arcade/ArcadeIcon';
import type { ArcadeIconName } from './arcade/icons';
import { PlayerAvatar } from './arcade/PlayerAvatar';
import styles from './VersusBarView.module.scss';

const MODALITY_ICON: Readonly<Record<VersusBarProps['modalityKey'], ArcadeIconName>> = { timeAttack: 'stopwatch', race: 'checkered-flag', fewestAttempts: 'crown-gold' };

/**
 * El HUD de una partida de versus (VersusHUD): modalidad, partida, relojes, tira de rivales, avisos y salir, con la identidad
 * Retro Battle. Es siempre el mismo en todas las franquicias: enmarca la competición y el minijuego conserva su propia piel.
 * No muestra nunca los intentos de los rivales, solo en qué partida van.
 */
export function VersusBarView({ modality, modalityKey, partida, clocks, warning, rivals, rivalsLabel, connection, notice, leaveLabel, onLeave, className }: VersusBarProps & { className?: string }) {
  const [main, ...others] = [...clocks].sort((a, b) => Number(b.main) - Number(a.main));
  return (
    <section className={[styles.root, className].filter(Boolean).join(' ')} aria-label={modality} data-versus-bar="" data-warning={warning || undefined}>
      <div className={styles.top}>
        <p className={styles.meta} data-part="meta">
          <ArcadeIcon name={MODALITY_ICON[modalityKey]} size="md" />
          <span className={styles.modality} data-part="modality">{modality}</span>
          <span className={styles.partida} data-part="partida">{partida}</span>
        </p>
        {main && (
          <p className={styles.clock} data-part="clock" data-main={main.main || undefined}>
            <span className={styles.label} data-part="label">{main.label}</span>
            {main.main ? (
              <time className={styles.time} role="timer" data-versus-clock="" data-part="time">{main.text}</time>
            ) : (
              <time className={styles.time} data-part="time">{main.text}</time>
            )}
          </p>
        )}
        {others.map((clock) => (
          <p key={clock.label} className={styles.clock} data-part="clock" data-small="">
            <span className={styles.label} data-part="label">{clock.label}</span>
            <time className={styles.time} data-part="time">{clock.text}</time>
          </p>
        ))}
      </div>
      {rivals && (
        <>
          <ul className={styles.rivals} aria-label={rivalsLabel} data-part="rivals">
            {rivals.map((rival) => (
              <li key={rival.id} className={styles.rival} data-part="rival" data-self={rival.self || undefined} data-gone={rival.gone || undefined} style={{ '--c': rival.color } as CSSProperties}>
                <PlayerAvatar name={rival.name} size="sm" />
                <strong>{rival.name}</strong>
                <span>{rival.status}</span>
              </li>
            ))}
          </ul>
          {connection && (
            <p className={styles.offline} role="status" data-part="offline">
              <ArcadeIcon name="wifi-off" size="sm" /> {connection}
            </p>
          )}
          <ul className={styles.notices} role="status" aria-live="polite" data-part="notices">
            {notice && <li>{notice}</li>}
          </ul>
          {onLeave && (
            <button type="button" className={styles.leave} data-part="leave" onClick={onLeave}>
              <ArcadeIcon name="arrow-left" size="sm" /> {leaveLabel}
            </button>
          )}
        </>
      )}
    </section>
  );
}
