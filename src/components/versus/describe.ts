import { franchises } from '@/franchises';
import type { ModeConfig } from '@/franchises/types';
import { es } from '@/i18n/es';
import { levelsOf } from '@/modes/timeline/logic';
import type { Partida, VersusConfig } from '@/versus/config';
import { visibleOptionsFor } from './draft';

// Cómo se nombra una partida de la sala en las listas (crear sala, sala de espera): franquicia, modo, variante y filtros.

const copy = es.versus.create;

/** Una opción de la variante de un modo. `id` es lo que se guarda en la partida (sin variante, `undefined`). */
export interface VariantOption {
  readonly id: string | undefined;
  readonly label: string;
}

export interface VariantChoice {
  readonly title: string;
  readonly options: readonly VariantOption[];
  /** La opción con la que arranca (índice). */
  readonly initial: number;
}

/** Cómo se elige la variante de un modo, o `null` si no tiene. */
export function variantsOf(mode: ModeConfig): VariantChoice | null {
  switch (mode.engine) {
    case 'higher-lower': {
      const metrics = mode.higherLower?.metrics ?? [];
      if (metrics.length < 2) return null;
      return {
        title: copy.sheet.variant,
        initial: 0,
        options: [{ id: undefined, label: copy.sheet.variantRandom }, ...metrics.map((metric) => ({ id: `m-${metric.key}`, label: metric.short ?? metric.label }))],
      };
    }
    case 'timeline': {
      const levels = mode.timeline ? levelsOf(mode.timeline) : [];
      if (levels.length < 2) return null;
      return {
        title: copy.sheet.level,
        initial: 0,
        options: levels.map((level, index) => ({ id: index === 0 ? undefined : `d${index + 1}`, label: `${es.timeline.levelNames[index] ?? es.timeline.level(index + 1)} · ${es.timeline.levelCount(level.count)}` })),
      };
    }
    case 'category-board':
      return { title: copy.sheet.level, initial: 1, options: es.categoryBoard.levels.map((label, index) => ({ id: index === 1 ? undefined : `d${index + 1}`, label })) };
    case 'stat-builder':
      return { title: copy.sheet.level, initial: 1, options: (mode.statBuilder?.targets ?? []).map((target, index) => ({ id: String(index), label: es.statBuilder.level(index, target) })) };
    default:
      return null;
  }
}

/** El nombre de la variante de una partida ("Normal · 10 sucesos", "Peso"), o `null` si no tiene o es la de siempre. */
export function variantLabel(mode: ModeConfig, variant: string | undefined): string | null {
  const choice = variantsOf(mode);
  if (!choice) return null;
  if (mode.engine === 'stat-builder') {
    const match = /^d(\d)-r([01])-m([01])$/.exec(variant ?? '');
    const level = match ? Number(match[1]) : 1;
    const forms: string[] = [];
    if (match?.[2] === '1') forms.push(copy.sheet.regional);
    if (match?.[3] === '1') forms.push(copy.sheet.mega);
    return [choice.options[level]?.label, ...forms].filter(Boolean).join(' · ');
  }
  if (variant === undefined) return mode.engine === 'higher-lower' ? copy.sheet.variantRandom : mode.engine === 'category-board' ? (choice.options[1]?.label ?? null) : (choice.options[0]?.label ?? null);
  return choice.options.find((option) => option.id === variant)?.label ?? null;
}

export interface BlockDescription {
  readonly franchise: string;
  readonly mode: string;
  readonly variant: string | null;
  /** Series y interruptores: "Todas las series", "Gen 1, Gen 2 · sin relleno". */
  readonly filters: string;
  /** El nombre completo para lectores de pantalla y botones ("Pokémon Clásico"). */
  readonly full: string;
}

/** Cómo se muestra una partida en una lista. */
export function describePartida(partida: Pick<Partida, 'franchise' | 'mode' | 'variant' | 'series' | 'toggles'>): BlockDescription {
  const franchise = franchises.find((candidate) => candidate.slug === partida.franchise);
  const mode = franchise?.modes.find((candidate) => candidate.slug === partida.mode);
  const franchiseName = franchise?.name ?? partida.franchise;
  const modeName = mode?.name ?? partida.mode;
  const all = franchise ? partida.series.length === franchise.series.length : false;
  const series = all
    ? copy.partidas.allSeries
    : partida.series.length <= 3
      ? partida.series.map((id) => franchise?.seriesLabels[id] ?? id).join(', ')
      : copy.partidas.seriesCount(partida.series.length, franchise?.series.length ?? partida.series.length);
  const off = Object.entries(partida.toggles ?? {})
    .filter(([, on]) => !on)
    .map(([id]) => copy.partidas.toggleOff(id === 'manga' ? es.filters.manga : es.filters.filler));
  return {
    franchise: franchiseName,
    mode: modeName,
    variant: mode ? variantLabel(mode, partida.variant) : null,
    filters: [series, ...off].join(' · '),
    full: `${franchiseName} ${modeName}`,
  };
}

/** Las opciones de una sala que valen para sus partidas y su modalidad, como líneas ("Mayor o Menor: meta de 10 aciertos"). */
export function optionLines(config: VersusConfig): string[] {
  const shown = visibleOptionsFor(config.modality, config.partidas.map((partida) => partida.engine));
  const { options } = config;
  const lines: string[] = [];
  if (shown.higherLowerTarget) lines.push(`${copy.options.higherLowerTarget}: ${options.higherLowerTarget}`);
  if (shown.higherLowerForgiven) lines.push(`${copy.options.higherLowerForgiven}: ${options.higherLowerForgiven}`);
  if (shown.statsTarget) lines.push(`${copy.options.statsTarget}: ${options.statsTarget}`);
  if (shown.statsAggregation) lines.push(`${copy.options.statsAggregation}: ${copy.options.aggregation[options.statsAggregation]}`);
  return lines;
}
