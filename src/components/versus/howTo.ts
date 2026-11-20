import type { VersusRules } from '@/components/game-shell/types';
import { es } from '@/i18n/es';
import type { Modality, Partida, VersusOptions } from '@/versus/config';
import { variantLine } from './describe';
import { formatClock } from './format';

// La pantalla "Cómo se juega" que va antes de cada modo de una sala de versus (ver `VersusHowTo` y `GameShell`).

/**
 * ¿Se muestra "Cómo se juega" antes de esta partida? Sí, salvo que la partida anterior de la sala sea del mismo modo (ya se
 * leyó hace un momento: "Clásico ×3" no repite la pantalla) o que el jugador ya haya tocado Continuar en esta (recargó la página).
 */
export function showsHowTo(partida: Pick<Partida, 'franchise' | 'mode'>, previous: Pick<Partida, 'franchise' | 'mode'> | undefined, seen: boolean): boolean {
  if (seen) return false;
  return !previous || previous.franchise !== partida.franchise || previous.mode !== partida.mode;
}

/**
 * Cómo corre esta partida en la sala: una línea de la modalidad y, aparte, las reglas especiales de esta partida según cómo se armó la sala:
 * la dificultad o la medida elegidas, y lo que fijan las opciones (la meta de aciertos y los fallos perdonados de Mayor o Menor; el puntaje
 * objetivo, las oportunidades y cómo se cuentan, la mejor, la suma o el promedio, de Estadísticas). Es lo que el texto de ayuda de siempre no
 * puede decir, porque cambia con la modalidad y con las opciones de la sala.
 */
export function versusRulesText(
  modality: Modality,
  partida: Pick<Partida, 'timeLimitMs'> & Partial<Pick<Partida, 'franchise' | 'mode' | 'variant' | 'engine'>>,
  rules: VersusRules | undefined,
  options?: Pick<VersusOptions, 'statsAggregation'>,
): { intro: string; lines: string[] } {
  const copy = es.versus;
  const intro =
    modality === 'timeAttack'
      ? copy.howTo.timeAttack(formatClock(partida.timeLimitMs ?? 0))
      : modality === 'race'
        ? copy.howTo.race
        : copy.howTo.fewestAttempts;
  const lines: string[] = [];
  // Primero lo que la persona eligió al armar la partida (dificultad o medida; en Estadísticas, también las formas).
  const variant = partida.franchise && partida.mode ? variantLine({ franchise: partida.franchise, mode: partida.mode, variant: partida.variant }) : null;
  if (variant) lines.push(copy.howTo.variant(variant.title, variant.label));
  if (rules?.targetScore !== undefined) lines.push(copy.howTo.higherLowerTarget(rules.targetScore));
  if (rules?.forgivenErrors !== undefined) lines.push(copy.howTo.higherLowerForgiven(rules.forgivenErrors));
  if (rules?.targetTotal !== undefined) lines.push(copy.howTo.statsTarget(rules.targetTotal));
  if (rules?.fixedAttempts !== undefined) {
    const attempts = rules.fixedAttempts;
    lines.push(copy.howTo.statsAttempts(attempts));
    // Con una sola oportunidad la mejor, la suma y el promedio dan lo mismo.
    lines.push(attempts === 1 ? copy.howTo.statsScore.single : copy.howTo.statsScore[options?.statsAggregation ?? 'best'](attempts));
  }
  return { intro, lines };
}
