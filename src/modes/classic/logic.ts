// Lógica pura del motor `classic`. Sin React y sin nada de ninguna franquicia:
// recibe las columnas, las pistas y las entidades por parámetro.

import { compareExact, compareOrdered, compareSet, type Direction } from '@/engine/compare';
import { filterAttrValue } from '@/engine/filters';
import type { AttrValue, Content, Entity } from '@/engine/types';
import type { ClassicColumn, ClassicHint } from './types';

export type CellMatch = 'exact' | 'partial' | 'none';

export interface Cell {
  column: ClassicColumn;
  /** Valor del intento, ya sin lo etiquetado con series inactivas. */
  value: AttrValue;
  match: CellMatch;
  /** Solo en columnas ordenables: hacia dónde está la respuesta. `null` si coincide o no es comparable. */
  direction: Direction | null;
  /** `true` si el valor del intento pertenece a una serie inactiva: no se muestra y no se compara. Ausente si no. */
  hidden?: true;
}

export interface AttemptRow {
  entity: Entity;
  cells: Cell[];
}

/**
 * Columnas que se muestran con las series activas. Una columna condicional
 * (`onlyForSeries`) aparece solo si todas las series activas están en su lista.
 */
export function visibleColumns(columns: readonly ClassicColumn[], active: readonly string[]): ClassicColumn[] {
  return columns.filter(
    (column) => column.onlyForSeries === undefined || active.every((id) => column.onlyForSeries?.includes(id)),
  );
}

function attrOf(entity: Entity, key: string, active: readonly string[]): AttrValue {
  // Regla 3 de la SPEC: los valores de series inactivas se ocultan antes de comparar.
  return filterAttrValue(entity.attrs[key] ?? null, active);
}

/** El valor de una columna con etiquetas que pertenece a una serie inactiva se oculta, como los valores etiquetados de un conjunto. */
function isHidden(column: ClassicColumn, value: AttrValue, active: readonly string[]): boolean {
  if (column.valueLabels === undefined || typeof value !== 'number') return false;
  const series = column.valueLabels[String(value)]?.series;
  return series !== undefined && !active.includes(series);
}

function compareColumn(column: ClassicColumn, guess: AttrValue, answer: AttrValue): Pick<Cell, 'match' | 'direction'> {
  switch (column.compare) {
    case 'exact':
      return { match: compareExact(guess, answer), direction: null };
    case 'set':
      return { match: compareSet(guess, answer), direction: null };
    case 'ordered': {
      const result = compareOrdered(guess, answer);
      return { match: result.match, direction: result.direction };
    }
  }
}

/** La fila de un intento: una celda por columna, comparada contra la respuesta. */
export function buildRow(
  guess: Entity,
  answer: Entity,
  columns: readonly ClassicColumn[],
  active: readonly string[],
): AttemptRow {
  return {
    entity: guess,
    cells: columns.map((column): Cell => {
      const value = attrOf(guess, column.key, active);
      const target = attrOf(answer, column.key, active);
      // Si el valor del intento o el de la respuesta está oculto, no hay con qué comparar: ni acierto ni flecha.
      const hiddenGuess = isHidden(column, value, active);
      if (hiddenGuess || isHidden(column, target, active)) {
        const cell: Cell = { column, value: hiddenGuess ? null : value, match: 'none', direction: null };
        return hiddenGuess ? { ...cell, hidden: true } : cell;
      }
      return { column, value, ...compareColumn(column, value, target) };
    }),
  };
}

const MATCH_EMOJI: Record<CellMatch, string> = { exact: '🟩', partial: '🟧', none: '🟥' };

/**
 * Grilla para compartir: una línea por intento, en el orden en que se jugaron,
 * con un cuadrado de color por columna. Solo colores: sin nombres, valores ni
 * flechas, así que no revela nada de la respuesta.
 */
export function shareGrid(rows: readonly AttemptRow[]): string[] {
  return rows.map((row) => row.cells.map((cell) => MATCH_EMOJI[cell.match]).join(''));
}

/** Intentos que no fueron la respuesta: son los que desbloquean pistas. */
export function failedCount(attemptIds: readonly string[], answerId: string): number {
  return attemptIds.filter((id) => id !== answerId).length;
}

export interface HintState {
  hint: ClassicHint;
  unlocked: boolean;
  /** Cuántos fallos más faltan para desbloquearla (0 si ya está). */
  remaining: number;
}

export function hintStates(hints: readonly ClassicHint[], failed: number): HintState[] {
  return hints.map((hint) => ({
    hint,
    unlocked: failed >= hint.after,
    remaining: Math.max(0, hint.after - failed),
  }));
}

/** El texto de una pista para la respuesta, o `null` si esa respuesta no tiene el dato. */
export function hintText(hint: ClassicHint, answer: Entity, contents: readonly Content[]): string | null {
  if (hint.kind === 'attr') return formatValue(answer.attrs[hint.key] ?? null);

  const content = contents.find((candidate) => candidate.kind === hint.contentKind && candidate.entityId === answer.id);
  const text = content?.payload[hint.field];
  return typeof text === 'string' && text.length > 0 ? text : null;
}

/**
 * El texto de la celda de un intento: el de `valueLabels` si la columna lo tiene para ese número, o el valor
 * con su unidad. `null` si no tiene valor.
 */
export function cellText(column: ClassicColumn, value: AttrValue): string | null {
  if (column.valueLabels !== undefined && typeof value === 'number') {
    const label = column.valueLabels[String(value)]?.label;
    if (label !== undefined) return label;
  }
  return formatValue(value, column.unit);
}

/** Valor listo para mostrar, con su unidad. `null` si no tiene valor (se muestra como "ninguno"). */
export function formatValue(value: AttrValue, unit?: string): string | null {
  if (value === null) return null;

  let text: string;
  if (typeof value === 'number') {
    text = value.toLocaleString('es-AR', { maximumFractionDigits: 2 });
  } else if (typeof value === 'string') {
    text = value;
  } else {
    if (value.length === 0) return null;
    text = value.map((item) => (typeof item === 'string' ? item : item.value)).join(', ');
  }
  return unit ? `${text} ${unit}` : text;
}

/**
 * Los intentos guardados que siguen siendo válidos: sin repetidos y solo de
 * entidades que están en el pool actual (el dataset pudo cambiar).
 */
export function restoreAttempts(stored: readonly unknown[] | undefined, pool: readonly Entity[]): string[] {
  const valid = new Set(pool.map((entity) => entity.id));
  const seen = new Set<string>();
  const restored: string[] = [];
  for (const id of stored ?? []) {
    if (typeof id === 'string' && valid.has(id) && !seen.has(id)) {
      seen.add(id);
      restored.push(id);
    }
  }
  return restored;
}
