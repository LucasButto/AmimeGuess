import { useContext } from 'react';
import { AttemptRules } from '@/components/game-shell/AttemptRules';
import { es } from '@/i18n/es';
import styles from './QuizHelp.module.scss';
import { optionCountOf } from './logic';
import { DEFAULT_ATTEMPTS, type QuizConfig } from './types';

interface QuizHelpProps {
  config: QuizConfig;
}

/** Lo que el Quiz aporta al "Cómo se juega": la pregunta del día, las opciones, los intentos y el retrato al pasar el cursor. */
export function QuizHelp({ config }: QuizHelpProps) {
  const rules = useContext(AttemptRules);
  return (
    <div className={styles.root}>
      <p>{es.quiz.help.goal(optionCountOf(config))}</p>
      <p>{es.quiz.help.attempts(rules?.base ?? DEFAULT_ATTEMPTS)}</p>
      <p>{es.quiz.help.hover}</p>
    </div>
  );
}
