'use client';

import { es } from '@/i18n/es';
import { ContentImage } from '../ContentImage';
import { CopyButton } from '../CopyButton';
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
}

/** Resumen al terminar el reto: revela la respuesta, cuenta cómo salió y ofrece compartir el resultado. */
export function ResultPanel({ won, attempts, score, answer, streak, getShareText }: ResultPanelProps) {
  const scored = score !== undefined;
  return (
    <section className={styles.root} data-won={won} aria-live="polite">
      {answer.imageStem && (
        <ContentImage className={styles.image} stem={answer.imageStem} alt="" sizes="(min-width: 48rem) 8rem, 6rem" priority />
      )}
      <div className={styles.content}>
        <h2 className={styles.title}>
          {scored ? es.shell.result.scoreTitle : won ? es.shell.result.wonTitle : es.shell.result.lostTitle}
        </h2>
        {/* En un modo de puntaje la respuesta es una frase libre y puede no haber ninguna. */}
        {scored ? answer.label && <p>{answer.label}</p> : <p>{es.shell.result.answerWas(answer.label)}</p>}
        <p className={styles.summary}>
          {scored
            ? es.shell.result.scoreSummary(score, streak)
            : won
              ? es.shell.result.wonSummary(attempts, streak)
              : es.shell.result.lostSummary}
        </p>
        <div className={styles.actions}>
          <CopyButton
            variant="primary"
            getText={getShareText}
            label={es.shell.result.share}
            copiedLabel={es.shell.result.shareCopied}
            failedLabel={es.shell.result.shareFailed}
          />
        </div>
      </div>
    </section>
  );
}
