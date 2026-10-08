'use client';

import { useEffect, useRef, useState } from 'react';
import { ContentImage } from '@/components/ContentImage';
import { VisuallyHidden } from '@/components/VisuallyHidden';
import { es } from '@/i18n/es';
import styles from './AttemptsTable.module.scss';
import { cellText, type AttemptRow, type Cell } from './logic';
import type { ClassicColumn } from './types';

interface AttemptsTableProps {
  /** Del intento más reciente al más antiguo. */
  rows: readonly AttemptRow[];
  columns: readonly ClassicColumn[];
}

// El color nunca va solo: cada resultado lleva además un ícono y un texto para lectores de pantalla.
const MATCH_ICON = { exact: '✓', partial: '≈', none: '✕' } as const;
const MATCH_TEXT = { exact: es.classic.cellExact, partial: es.classic.cellPartial, none: es.classic.cellNone } as const;

function iconOf(cell: Cell): string {
  if (cell.direction === 'up') return '↑';
  if (cell.direction === 'down') return '↓';
  return MATCH_ICON[cell.match];
}

function descriptionOf(cell: Cell): string {
  const direction =
    cell.direction === 'up' ? es.classic.answerHigher : cell.direction === 'down' ? es.classic.answerLower : null;
  return direction ? `${MATCH_TEXT[cell.match]}. ${direction}` : MATCH_TEXT[cell.match];
}

/**
 * Tabla de intentos. A 360 px no entran todas las columnas legibles, así que
 * el desplazamiento horizontal ocurre solo acá dentro: el nombre y el
 * encabezado quedan fijos y un degradé a la derecha avisa que hay más.
 */
export function AttemptsTable({ rows, columns }: AttemptsTableProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ scrollable: false, moreToRight: false });

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
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.entity.id}>
                <th scope="row" className={styles.name}>
                  {row.entity.image && (
                    <ContentImage className={styles.thumb} stem={row.entity.image} alt="" sizes="2.5rem" />
                  )}
                  <span>{row.entity.name.es}</span>
                </th>
                {row.cells.map((cell) => {
                  const text = cellText(cell.column, cell.value);
                  return (
                    <td key={cell.column.key} className={styles.cell}>
                      <div className={styles.box} data-match={cell.match}>
                        <span className={styles.value}>
                          {text ?? (
                            <>
                              <span aria-hidden="true">—</span>
                              <VisuallyHidden>{cell.hidden ? es.classic.hiddenValue : es.classic.noValue}</VisuallyHidden>
                            </>
                          )}
                        </span>
                        <span className={styles.icon} aria-hidden="true">
                          {iconOf(cell)}
                        </span>
                        <VisuallyHidden>{`. ${descriptionOf(cell)}`}</VisuallyHidden>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
