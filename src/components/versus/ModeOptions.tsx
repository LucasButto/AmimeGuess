'use client';

import { Chip } from '@/components/ui/Chip';
import { InfoTip } from '@/components/ui/InfoTip';
import { PixelIcon } from '@/components/ui/icons';
import { es } from '@/i18n/es';
import { LIMITS, STATS_AGGREGATIONS, type Modality, type VersusEngine, type VersusOptions } from '@/versus/config';
import { visibleOptionsFor } from './draft';
import { NumberField } from './NumberField';
import styles from './ModeOptions.module.scss';

const copy = es.versus.create;

/** Si este tipo de partida tiene opciones propias en esta modalidad (la meta de Mayor o Menor, las oportunidades de Estadísticas…). */
export function hasModeOptions(engine: VersusEngine, modality: Modality): boolean {
  return Object.values(visibleOptionsFor(modality, [engine])).some(Boolean);
}

interface ModeOptionsProps {
  /** El tipo de partida cuyas opciones se muestran. */
  engine: VersusEngine;
  modality: Modality;
  options: VersusOptions;
  onChange: <K extends keyof VersusOptions>(key: K, value: VersusOptions[K]) => void;
  /** Para que los ids de los rótulos no se repitan si las opciones salen en dos lugares a la vez. */
  idPrefix: string;
}

/**
 * Los campos de las opciones de una partida, los mismos en la hoja "Agregar partida" y en el panel "Opciones" de la sala: Mayor o Menor
 * (meta de aciertos en Contrarreloj y Carrera; fallos perdonados en Menos intentos) y Estadísticas (puntaje objetivo; en Menos intentos, cuántas
 * oportunidades y cómo se cuentan: la mejor, la suma o el promedio, cada una con su ⓘ). Son opciones de la sala: valen para todas las partidas
 * de ese modo. Sin opciones para ese motor y modalidad, no dibuja nada.
 */
export function ModeOptions({ engine, modality, options, onChange, idPrefix }: ModeOptionsProps) {
  const shown = visibleOptionsFor(modality, [engine]);
  const labelId = `${idPrefix}-aggregation`;
  return (
    <>
      {shown.higherLowerTarget && (
        <NumberField label={copy.options.higherLowerTarget} value={options.higherLowerTarget} min={LIMITS.higherLowerTarget.min} max={LIMITS.higherLowerTarget.max} hint={copy.options.higherLowerTargetHint} lessLabel={copy.options.less} moreLabel={copy.options.more} onChange={(value) => onChange('higherLowerTarget', value)} />
      )}
      {shown.higherLowerForgiven && (
        <NumberField label={copy.options.higherLowerForgiven} value={options.higherLowerForgiven} min={LIMITS.higherLowerForgiven.min} max={LIMITS.higherLowerForgiven.max} hint={copy.options.higherLowerForgivenHint} lessLabel={copy.options.less} moreLabel={copy.options.more} onChange={(value) => onChange('higherLowerForgiven', value)} />
      )}
      {shown.statsTarget && (
        <NumberField label={copy.options.statsTarget} value={options.statsTarget} min={LIMITS.statsTarget.min} max={LIMITS.statsTarget.max} step={LIMITS.statsTarget.step} hint={copy.options.statsTargetHint} lessLabel={copy.options.less} moreLabel={copy.options.more} onChange={(value) => onChange('statsTarget', value)} />
      )}
      {shown.statsAttempts && (
        <NumberField label={copy.options.statsAttempts} value={options.statsAttempts} min={LIMITS.statsAttempts.min} max={LIMITS.statsAttempts.max} hint={copy.options.statsAttemptsHint} lessLabel={copy.options.less} moreLabel={copy.options.more} onChange={(value) => onChange('statsAttempts', value)} />
      )}
      {/* Con una sola oportunidad la mejor, la suma y el promedio dan lo mismo: no hay nada que elegir. */}
      {shown.statsAggregation && options.statsAttempts > 1 && (
        <div className={styles.aggregation}>
          <p className={styles.fieldLabel} id={labelId}>{copy.options.statsAggregation}</p>
          <div className={styles.chips} role="group" aria-labelledby={labelId}>
            {STATS_AGGREGATIONS.map((value) => (
              // El circulito ⓘ va adentro del botón de la opción (un botón no puede llevar otro botón adentro): es solo el dibujo, y el recuadro
              // de ayuda se abre al pasar el cursor por la opción (`hoverOnly`). Con el teclado o el dedo, la ayuda de la opción elegida queda escrita abajo.
              <span key={value} className={styles.choice}>
                <Chip pressed={options.statsAggregation === value} onClick={() => onChange('statsAggregation', value)}>
                  {copy.options.aggregation[value]}
                  <span className={styles.dot} aria-hidden="true"><PixelIcon name="info" /></span>
                </Chip>
                <InfoTip hoverOnly text={copy.options.aggregationHelp[value]} label={es.help.button(copy.options.aggregation[value])} />
              </span>
            ))}
          </div>
          <p className={styles.note} role="status">{copy.options.aggregationHelp[options.statsAggregation]}</p>
        </div>
      )}
    </>
  );
}
