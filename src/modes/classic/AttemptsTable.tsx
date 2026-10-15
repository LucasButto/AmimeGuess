'use client';

import { useEffect, useRef, useState, type AnimationEvent, type CSSProperties } from 'react';
import { ContentImage } from '@/components/ContentImage';
import { useSkin } from '@/components/skin/context';
import { PixelIcon, type IconName } from '@/components/ui/icons';
import { InfoTip } from '@/components/ui/InfoTip';
import { VisuallyHidden } from '@/components/VisuallyHidden';
import { es } from '@/i18n/es';
import styles from './AttemptsTable.module.scss';
import { cellText, type AttemptRow, type Cell } from './logic';
import type { RevealTiming } from './reveal';
import type { ClassicColumn } from './types';

interface AttemptsTableProps {
  /** Del intento más reciente al más antiguo. */
  rows: readonly AttemptRow[];
  columns: readonly ClassicColumn[];
  /**
   * La fila que se está revelando (la recién enviada) y sus tiempos. Solo esa se anima: las anteriores y las
   * restauradas al recargar aparecen directamente en su estado final.
   */
  revealing?: { readonly id: string; readonly timing: RevealTiming } | null;
  /** Se llama cuando termina la animación de la última celda de la fila que se revela. */
  onRevealEnd?: (id: string) => void;
}

// El color nunca va solo: cada resultado lleva además un ícono y un texto para lectores de pantalla.
const MATCH_ICON = { exact: '✓', partial: '≈', none: '✕' } as const;
const MATCH_PIXEL: Record<Cell['match'], IconName> = { exact: 'check', partial: 'partial', none: 'cross' };
const MATCH_TEXT = { exact: es.classic.cellExact, partial: es.classic.cellPartial, none: es.classic.cellNone } as const;

function iconOf(cell: Cell): string {
  if (cell.direction === 'up') return '↑';
  if (cell.direction === 'down') return '↓';
  return MATCH_ICON[cell.match];
}

function pixelIconOf(cell: Cell): IconName {
  if (cell.direction === 'up') return 'arrowUp';
  if (cell.direction === 'down') return 'arrowDown';
  return MATCH_PIXEL[cell.match];
}

/**
 * ¿La celda lleva ícono? Con `all`, siempre. Con `hints`, solo las que el color no explica del todo: el parcial
 * y las que tienen flecha. Con `arrows`, solo las que tienen flecha. Lo que está bien (verde) o mal sin más pistas (rojo) se lee por el color; el texto
 * para lectores de pantalla (`descriptionOf`) está en todas.
 */
function hasMark(cell: Cell, marks: 'all' | 'hints' | 'arrows'): boolean {
  return marks === 'all' || (marks === 'hints' && cell.match === 'partial') || cell.direction !== null;
}

function descriptionOf(cell: Cell): string {
  const direction =
    cell.direction === 'up' ? es.classic.answerHigher : cell.direction === 'down' ? es.classic.answerLower : null;
  return direction ? `${MATCH_TEXT[cell.match]}. ${direction}` : MATCH_TEXT[cell.match];
}

/**
 * Tabla de intentos. A 360 px no entran todas las columnas legibles, así que
 * el desplazamiento horizontal ocurre solo acá dentro: el nombre y el
 * encabezado quedan fijos y un degradé (y, según el tema, una flecha) a la
 * derecha avisa que hay más.
 *
 * Revelación (SPEC 9.2): en la fila nueva, el nombre cae enseguida y cada columna de atributos gira desde su
 * dorso (slot `CellBack`) hasta su cara, de izquierda a derecha, con los retrasos de `revealing.timing`. Cada
 * celda lleva `data-reveal` (`revealing` o `face`) y `data-index`; el tema anima su dorso a partir de eso. La
 * cara está siempre en el flujo y reserva la altura de la fila: el dorso va encima, sin saltos de layout.
 */
export function AttemptsTable({ rows, columns, revealing = null, onRevealEnd }: AttemptsTableProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ scrollable: false, moreToRight: false });
  const { skin } = useSkin();
  const { CellBack, ValueMark } = skin.slots;

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const measure = () => {
      setOverflow({
        scrollable: scroller.scrollWidth > scroller.clientWidth || scroller.scrollHeight > scroller.clientHeight,
        moreToRight: scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1,
      });
    };

    // Mide al montar, al cambiar el tamaño de la tabla (filas o columnas nuevas) y al desplazar.
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    if (scroller.firstElementChild) observer.observe(scroller.firstElementChild);
    scroller.addEventListener('scroll', measure, { passive: true });
    return () => {
      observer.disconnect();
      scroller.removeEventListener('scroll', measure);
    };
  }, []);

  return (
    <div className={styles.frame} data-more={overflow.moreToRight}>
      <div
        ref={scrollerRef}
        className={styles.scroller}
        role="region"
        aria-label={es.classic.tableCaption}
        // Solo se puede enfocar si hay algo que desplazar: así se recorre con el teclado.
        tabIndex={overflow.scrollable ? 0 : undefined}
      >
        <table className={styles.table}>
          <caption>
            <VisuallyHidden>{es.classic.tableCaption}</VisuallyHidden>
          </caption>
          <thead>
            <tr>
              <th scope="col" className={`${styles.head} ${styles.nameHead}`}>
                {es.classic.nameHeader}
              </th>
              {columns.map((column) => (
                <th key={column.key} scope="col" className={styles.head}>
                  <span className={styles.headInner}>
                    {column.label}
                    {column.help && <InfoTip compact text={column.help} label={es.help.button(column.label)} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const animate = revealing !== null && revealing.id === row.entity.id;
              const last = row.cells.length - 1;
              return (
                <tr key={row.entity.id} data-reveal={animate ? 'revealing' : 'face'}>
                  <th scope="row" className={styles.name}>
                    <div className={styles.nameInner} data-reveal={animate ? 'revealing' : 'face'}>
                      {row.entity.image && (
                        <ContentImage className={styles.thumb} stem={row.entity.image} alt="" sizes="2.5rem" />
                      )}
                      <span>{row.entity.name.es}</span>
                    </div>
                  </th>
                  {row.cells.map((cell, index) => {
                    const text = cellText(cell.column, cell.value);
                    // El retraso de cada columna es un valor calculado al enviar el intento: el único estilo en línea.
                    const delay = animate ? ({ '--reveal-delay': `${revealing.timing.delays[index] ?? 0}ms` } as CSSProperties) : undefined;
                    const handleEnd =
                      animate && index === last
                        ? (event: AnimationEvent<HTMLDivElement>) => {
                            if (event.target === event.currentTarget) onRevealEnd?.(row.entity.id);
                          }
                        : undefined;
                    return (
                      <td key={cell.column.key} className={styles.cell}>
                        <div
                          className={styles.flip}
                          data-reveal={animate ? 'revealing' : 'face'}
                          data-index={index}
                          data-mode={skin.revealMode}
                          style={delay}
                        >
                          <div className={styles.box} data-match={cell.match} onAnimationEnd={handleEnd}>
                            <ValueMark column={cell.column.key} value={text ?? ''} />
                            <span className={styles.value} data-large={cell.column.large || undefined}>
                              {text ?? (
                                <>
                                  <span aria-hidden="true">—</span>
                                  <VisuallyHidden>{cell.hidden ? es.classic.hiddenValue : es.classic.noValue}</VisuallyHidden>
                                </>
                              )}
                            </span>
                            {hasMark(cell, skin.cellMarks) && (
                              <span className={styles.icon} aria-hidden="true">
                                {skin.cellIcons === 'pixel' ? <PixelIcon name={pixelIconOf(cell)} /> : iconOf(cell)}
                              </span>
                            )}
                            <VisuallyHidden>{`. ${descriptionOf(cell)}`}</VisuallyHidden>
                          </div>
                          {/* El dorso: decorativo, encima de la cara mientras gira. */}
                          {animate && (
                            <div className={styles.back} aria-hidden="true">
                              <CellBack index={index} />
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <span className={styles.moreHint} aria-hidden="true">
        <PixelIcon name="cursor" />
      </span>
    </div>
  );
}
