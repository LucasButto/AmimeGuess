import { es } from '@/i18n/es';
import type { AttemptsMeterProps, StreakDisplayProps } from '../../types';
import styles from './Extras.module.scss';

/** Tazones visibles: desde el octavo día de racha se agrega "+N". */
const BOWLS = 7;

/** Un tazón de ramen visto de costado: el caldo con fideos, una rodaja de narutomaki y los palillos. Dibujo propio. */
function Bowl() {
  return (
    <svg className={styles.bowl} viewBox="0 0 32 28" aria-hidden="true" focusable="false">
      <path className={styles.sticks} d="M18 2 L 28 13 M 22 1 L 30 11" />
      <path className={styles.broth} d="M3 13 H29" />
      <path className={styles.noodles} d="M7 12 C 9 9, 11 12, 13 10 C 15 8, 17 11, 19 9" />
      <circle className={styles.fishcake} cx="23" cy="10.5" r="2.5" />
      <path className={styles.china} d="M2 13 H30 C 30 20, 24 25, 16 25 C 8 25, 2 20, 2 13 Z" />
      <path className={styles.band} d="M5 17 H27" />
      <path className={styles.foot} d="M11 25 H21 V27 H11 Z" />
    </svg>
  );
}

/**
 * Slot `StreakDisplay`: un tazón de ramen por día de racha (hasta 7 a la vista; desde ahí, "+N"), con el número de la
 * racha siempre al lado. Decorativo: el resumen ya dice la racha con palabras.
 */
export function RamenStreak({ streak }: StreakDisplayProps) {
  const shown = Math.min(streak, BOWLS);
  return (
    <span className={styles.ramen} aria-hidden="true">
      {shown > 0 && (
        <span className={styles.bowls}>
          {Array.from({ length: shown }, (_, index) => (
            <Bowl key={index} />
          ))}
        </span>
      )}
      {streak > BOWLS && <span className={styles.more}>{es.narutoSkin.bowlsMore(streak - BOWLS)}</span>}
      <span className={styles.streakNumber}>{streak}</span>
    </span>
  );
}

/** Cuántos fallos vacían la barra de chakra en los modos sin límite de intentos. */
const CHAKRA_STEPS = 10;

/**
 * Slot `AttemptsMeter`: una barra de chakra azul que baja con cada intento fallido (en un modo con límite, de a un
 * intento del total). Solo presentación: el número de intentos ya está escrito al lado.
 */
export function ChakraMeter({ failed, won, total }: AttemptsMeterProps) {
  const steps = total ?? CHAKRA_STEPS;
  const left = Math.max(won ? 1 : 0, steps - failed) / steps;
  return (
    <span className={styles.chakra} aria-hidden="true">
      <span className={styles.chakraLabel}>{es.narutoSkin.chakra}</span>
      <span className={styles.chakraTrack} data-low={left <= 0.3}>
        {/* Proporción calculada de los fallos: el único estilo en línea. */}
        <span className={styles.chakraFill} style={{ transform: `scaleX(${left})` }} />
      </span>
    </span>
  );
}
