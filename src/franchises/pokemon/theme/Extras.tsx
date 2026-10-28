import { PixelArt } from '@/components/ui/PixelArt';
import { es } from '@/i18n/es';
import type { AttemptsMeterProps, MetricMarkProps, StreakDisplayProps, ValueMarkProps } from '../../types';
import { inlineArt } from './art';
import styles from './Extras.module.scss';
import { METRIC_ICONS, MEDAL_COUNT, isTypeName, medal, metricIconKey } from './extras-art';
import { TypeBadge } from './TypeBadge';
import { PokeBall } from './PokeBall';

/** Columnas del Clásico cuyo valor es un tipo. */
const TYPE_COLUMNS = new Set(['tipo1', 'tipo2']);

/**
 * Slot `ValueMark`: insignia de tipo decorativa; el nombre sigue escrito al lado.
 */
export function TypeMark({ column, value }: ValueMarkProps) {
  if (!TYPE_COLUMNS.has(column) || !isTypeName(value)) return null;
  return <TypeBadge type={value} />;
}

/**
 * Slot `MetricMark`: al lado de la pregunta de Mayor o Menor, el ícono de lo que se compara (una pesa para el peso,
 * una flecha doble para la altura, barras para las estadísticas, una chapa con "#" para el número de la Pokédex). Decorativo: la pregunta ya lo dice con palabras.
 */
export function MetricIcon({ metric }: MetricMarkProps) {
  const key = metricIconKey(metric);
  if (key === null) return null;
  return <PixelArt art={inlineArt(METRIC_ICONS[key])} size="fill" className={styles.metric} />;
}

/** Racha que se muestra entera con medallas: desde ahí, "+N". */
const MEDALS = MEDAL_COUNT;

/**
 * Slot `StreakDisplay`: un medallero de 8 medallas pixel. Cada día de racha enciende una; desde la octava
 * se agrega "+N". El número de la racha queda siempre a la vista (y el resumen lo dice con palabras).
 */
export function StreakMedals({ streak }: StreakDisplayProps) {
  const lit = Math.min(streak, MEDALS);
  return (
    <span className={styles.medals} aria-hidden="true">
      <span className={styles.medalRow}>
        {Array.from({ length: MEDALS }, (_, index) => (
          <PixelArt key={index} art={inlineArt(medal(index, index < lit))} size="fill" className={styles.medal} />
        ))}
      </span>
      <span className={styles.streakNumber}>{streak > MEDALS ? es.pokemonSkin.medalsMore(streak - MEDALS) : streak}</span>
    </span>
  );
}

/** Cuántos fallos vacían la barra de PS. */
const HP_STEPS = 10;

/**
 * Slot `AttemptsMeter`: una barra de PS que baja con cada intento fallido (verde, amarilla y roja según lo que
 * queda). Solo presentación: el número de intentos ya está escrito al lado.
 */
export function HpMeter({ failed, won }: AttemptsMeterProps) {
  const left = won ? Math.max(1, HP_STEPS - failed) / HP_STEPS : Math.max(0, HP_STEPS - failed) / HP_STEPS;
  const level = left > 0.5 ? 'high' : left > 0.2 ? 'mid' : 'low';
  return (
    <span className={styles.hp} aria-hidden="true">
      <span className={styles.hpLabel}>{es.pokemonSkin.hp}</span>
      <span className={styles.hpTrack} data-level={level}>
        {/* Proporción calculada de los fallos: el único estilo en línea. */}
        <span className={styles.hpFill} style={{ transform: `scaleX(${left})` }} />
      </span>
    </span>
  );
}

/**
 * Slot `PageTransition`: al entrar a un modo, barras horizontales oscuras que se abren hacia los costados,
 * como al empezar un combate (400 ms, a pasos). No intercepta la navegación: es una animación de entrada,
 * encima de todo y sin recibir toques. Con movimiento reducido no aparece.
 */
export function BattleIntro() {
  return (
    <span className={styles.intro} aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => (
        <span key={index} className={styles.introBar} data-side={index % 2 === 0 ? 'left' : 'right'} />
      ))}
    </span>
  );
}

/**
 * Slot `PageExit`: al salir de una pantalla, las mismas barras se cierran desde los costados hasta tapar todo, y recién
 * ahí se navega; la pantalla nueva abre las suyas (`BattleIntro`) y no aparece un negro de golpe. Tapa los toques
 * mientras dura, para que un segundo clic no navegue dos veces.
 */
export function BattleOutro() {
  return (
    <span className={styles.outro} aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => (
        <span key={index} className={styles.outroBar} data-side={index % 2 === 0 ? 'left' : 'right'} />
      ))}
    </span>
  );
}

/** Slot `Loader`: una Poké Ball que gira a pasos (quieta con movimiento reducido). */
export function BallLoader() {
  return (
    <span className={styles.loader} aria-hidden="true">
      <PokeBall unit="half" />
    </span>
  );
}
