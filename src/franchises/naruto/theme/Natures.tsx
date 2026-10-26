import { InfoTip } from '@/components/ui/InfoTip';
import type { ValueMarkProps } from '../../types';
import styles from './Natures.module.scss';

/** El kanji de cada naturaleza de chakra (el nombre en japonés de cada elemento). */
const KANJI: Readonly<Record<string, string>> = {
  Fuego: '火',
  Viento: '風',
  Rayo: '雷',
  Tierra: '土',
  Agua: '水',
  Yin: '陰',
  Yang: '陽',
};

/**
 * Slot `ValueMark` de Naruto: en la columna Naturalezas del Clásico, cada naturaleza es un octágono de su color con su
 * kanji (Yin-Yang, mitad negro y mitad blanco con los dos). En lugar del texto de la celda (ver `Natures.module.scss`):
 * cada ícono dice su nombre al pasar el cursor, enfocarlo o tocarlo, y ese es su nombre accesible. Dibujo propio.
 */
export function NatureMarks({ column, value }: ValueMarkProps) {
  if (column !== 'naturalezas' || value.length === 0) return null;
  const natures = value.split(', ').filter((nature) => nature === 'Yin-Yang' || nature in KANJI);
  if (natures.length === 0) return null;
  return (
    <span className={styles.natures} data-natures="" data-inline-targets="">
      {natures.map((nature) => (
        <InfoTip key={nature} text={nature} label={nature} className={styles.tip}>
          <span className={styles.nature} data-nature={nature} aria-hidden="true">
            {nature === 'Yin-Yang' ? (
              <>
                <span className={styles.half}>{KANJI.Yin}</span>
                <span className={styles.half}>{KANJI.Yang}</span>
              </>
            ) : (
              <span>{KANJI[nature]}</span>
            )}
          </span>
        </InfoTip>
      ))}
    </span>
  );
}
