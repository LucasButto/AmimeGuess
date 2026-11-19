import type { ReactNode } from 'react';
import { es } from '@/i18n/es';
import styles from './HowToPlay.module.scss';

interface HowToPlayProps {
  franchise: string;
  mode: string;
  /** La explicación propia del motor (`help` del marco). */
  help?: ReactNode;
  /**
   * Versus: antes del texto del modo, `versusRules` dice cómo corre la partida en la sala (tiempo, meta, combinaciones).
   */
  versusRules?: { readonly intro: string; readonly lines: readonly string[] };
}

/**
 * El texto de "Cómo se juega" de un modo: lo que se ve en el modal de ayuda y, en versus, en la pantalla previa a cada partida.
 * Solo la explicación del modo (más las reglas de la sala en versus): nada del reto diario.
 */
export function HowToPlay({ franchise, mode, help, versusRules }: HowToPlayProps) {
  const modeHelp = es.modeHelp[franchise]?.[mode];
  return (
    <div className={styles.help}>
      {/* En la sala, lo que cambia la partida (el tiempo, la meta) va primero: es lo que hay que saber antes de tocar Continuar. */}
      {versusRules && (
        <section>
          <h3 className={styles.helpTitle}>{es.versus.howTo.rulesTitle}</h3>
          <ul className={styles.helpList}>
            <li>{versusRules.intro}</li>
            {versusRules.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}
      {modeHelp && <p>{modeHelp}</p>}
      {help}
    </div>
  );
}
