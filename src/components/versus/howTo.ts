import type { VersusRules } from '@/components/game-shell/types';
import { es } from '@/i18n/es';
import type { Modality, Partida } from '@/versus/config';
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
 * Cómo corre esta partida en la sala: una línea de la modalidad y, aparte, las reglas especiales del modo (meta de aciertos,
 * fallos perdonados, objetivo y combinaciones de Estadísticas). Es lo que el texto de ayuda de siempre no puede decir, porque
 * cambia con la modalidad y con las opciones de la sala.
 */
export function versusRulesText(modality: Modality, partida: Pick<Partida, 'timeLimitMs'>, rules: VersusRules | undefined): { intro: string; lines: string[] } {
  const copy = es.versus;
  const intro =
    modality === 'timeAttack'
      ? copy.howTo.timeAttack(formatClock(partida.timeLimitMs ?? 0))
      : modality === 'race'
        ? copy.howTo.race
        : copy.howTo.fewestAttempts;
  const lines: string[] = [];
  if (rules?.targetScore !== undefined) lines.push(copy.target(rules.targetScore));
  if (rules?.forgivenErrors !== undefined) lines.push(copy.forgiven(rules.forgivenErrors));
  if (rules?.targetTotal !== undefined) lines.push(copy.targetTotal(rules.targetTotal));
  if (rules?.fixedAttempts !== undefined) lines.push(copy.howTo.fixedCombinations(rules.fixedAttempts));
  return { intro, lines };
}
