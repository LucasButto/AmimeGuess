import { es } from '@/i18n/es';
import styles from './ImageRevealHelp.module.scss';
import type { RevealVariant } from './types';

interface ImageRevealHelpProps {
  variant: RevealVariant;
}

/** Lo que el motor de imagen aporta al "Cómo se juega": la meta según la variante, los pasos y los interruptores. */
export function ImageRevealHelp({ variant }: ImageRevealHelpProps) {
  return (
    <div className={styles.root}>
      <p>{es.imageReveal.help.goal[variant]}</p>

      <section>
        <h3 className={styles.title}>{es.imageReveal.help.stepsTitle}</h3>
        <p>{es.imageReveal.help.steps}</p>
      </section>

      <section>
        <h3 className={styles.title}>{es.imageReveal.help.difficultyTitle}</h3>
        <p>{variant === 'zoom-silhouette' ? es.imageReveal.help.difficultyNoColors : es.imageReveal.help.difficulty}</p>
      </section>
    </div>
  );
}
