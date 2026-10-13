'use client';

import type { ReactNode } from 'react';
import { es } from '@/i18n/es';
import { ContentImage } from '../ContentImage';
import { CopyButton } from '../CopyButton';
import { useSkin } from '../skin/context';
import { Panel } from '../ui/Panel';
import styles from './ResultPanel.module.scss';
import type { AnswerInfo } from './types';

interface ResultPanelProps {
  won: boolean;
  attempts: number;
  /** Solo en modos de puntaje: los aciertos seguidos. Cambia el título y el resumen, y la respuesta pasa a ser una frase libre. */
  score?: number;
  /** La respuesta del reto, para revelarla. */
  answer: AnswerInfo;
  /** Racha vigente de días con alguna victoria en este modo. */
  streak: number;
  /** Arma el texto para compartir cuando se hace clic. */
  getShareText: () => string;
  /** Acción que va antes que compartir (por ejemplo, seguir jugando en el modo infinito). */
  leadingAction?: ReactNode;
  /** Más acciones junto a compartir (por ejemplo, copiar el link). */
  actions?: ReactNode;
  /** Partida del modo infinito: no hay racha ni se comparte, y el resumen no habla de "hoy" ni de "mañana". */
  practice?: boolean;
}

/**
 * Resumen al terminar el reto: revela la respuesta, cuenta cómo salió y ofrece compartir el resultado. Es un
 * cuadro de diálogo del tema (Panel `dialog`). Al ganar un reto de intentos, el slot `WinCelebration` del
 * tema puede festejar sobre la imagen y debajo del resumen, y `StreakDisplay` muestra la racha a su manera.
 */
export function ResultPanel({ won, attempts, score, answer, streak, getShareText, leadingAction, actions, practice = false }: ResultPanelProps) {
  const { skin } = useSkin();
  const { WinCelebration, StreakDisplay } = skin.slots;
  const scored = score !== undefined;
  const celebrate = won && !scored;
  const namesAnswer = celebrate && skin.winHeadline === 'answer';
  const title = scored
    ? es.shell.result.scoreTitle
    : namesAnswer
      ? es.shell.result.answerTitle(answer.label)
      : won
        ? es.shell.result.wonTitle
        : practice
          ? es.shell.practice.lostTitle
          : es.shell.result.lostTitle;

  return (
    <Panel as="section" variant="dialog" className={styles.root} data-won={won} aria-live="polite">
      {/* Franja de color del resultado (si el tema la usa): acompaña al título, no lo reemplaza. */}
      <span className={styles.mark} aria-hidden="true" />
      <div className={styles.main}>
        {answer.imageStem && (
          <div className={styles.media}>
            <ContentImage className={styles.image} stem={answer.imageStem} alt="" sizes="(min-width: 48rem) 8rem, 6rem" priority />
            {celebrate && <WinCelebration part="media" label={answer.label} imageStem={answer.imageStem} />}
          </div>
        )}
        <div className={styles.content}>
          <h2 className={styles.title}>{title}</h2>
          {/* En un modo de puntaje la respuesta es una frase libre y puede no haber ninguna. */}
          {scored ? answer.label && <p>{answer.label}</p> : !namesAnswer && <p>{es.shell.result.answerWas(answer.label)}</p>}
          <p className={styles.summary}>
            {practice
              ? scored
                ? es.shell.practice.scoreSummary(score)
                : won
                  ? es.shell.practice.wonSummary(attempts)
                  : es.shell.practice.lostSummary
              : scored
                ? es.shell.result.scoreSummary(score, streak)
                : won
                  ? es.shell.result.wonSummary(attempts, streak)
                  : es.shell.result.lostSummary}
          </p>
          {!practice && <StreakDisplay streak={streak} />}
          <div className={styles.actions}>
            {leadingAction}
            {!practice && (
              <CopyButton
                variant="accent"
                getText={getShareText}
                label={es.shell.result.share}
                copiedLabel={es.shell.result.shareCopied}
                failedLabel={es.shell.result.shareFailed}
              />
            )}
            {actions}
          </div>
        </div>
      </div>
      {celebrate && <WinCelebration part="details" label={answer.label} imageStem={answer.imageStem} />}
    </Panel>
  );
}
