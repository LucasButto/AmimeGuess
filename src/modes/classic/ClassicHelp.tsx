import { es } from '@/i18n/es';
import styles from './ClassicHelp.module.scss';
import type { ClassicConfig } from './types';

interface ClassicHelpProps {
  config: ClassicConfig;
}

/** Lo que el Clásico aporta al "Cómo se juega": la meta, la leyenda de colores y las pistas de su config. */
export function ClassicHelp({ config }: ClassicHelpProps) {
  const legend = [
    { match: 'exact', icon: '✓', text: es.classic.help.exact },
    { match: 'partial', icon: '≈', text: es.classic.help.partial },
    { match: 'none', icon: '✕', text: es.classic.help.none },
    { match: 'none', icon: '↑↓', text: es.classic.help.arrows },
  ] as const;

  return (
    <div className={styles.root}>
      <p>{es.classic.help.goal}</p>

      <section>
        <h3 className={styles.title}>{es.classic.help.colorsTitle}</h3>
        <ul className={styles.legend}>
          {legend.map((item) => (
            <li key={item.text} className={styles.item}>
              {/* Mismas muestras que la tabla: color + ícono, nunca solo color. */}
              <span className={styles.swatch} data-match={item.match} aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
        {config.columns.some((column) => column.onlyForSeries) && <p className={styles.note}>{es.classic.help.columnsNote}</p>}
      </section>

      {config.hints.length > 0 && (
        <section>
          <h3 className={styles.title}>{es.classic.help.hintsTitle}</h3>
          <p>{es.classic.help.hintsIntro}</p>
          <ul className={styles.hints}>
            {config.hints.map((hint) => (
              <li key={hint.label}>{es.classic.help.hint(hint.label, hint.after)}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
