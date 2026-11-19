import { hasMinimumPool } from '@/engine/filters';
import { withoutFlagged, type FranchiseData } from '@/franchises/data';
import { minimumPoolOf, modePoolSize } from '@/franchises/pool';
import type { FranchiseConfig, ModeConfig } from '@/franchises/types';
import { isPlayable } from '@/app/[franchise]/[mode]/playable';
import type { Partida, VersusConfig } from '@/versus/config';

// Lo que el servidor de salas no puede comprobar porque no conoce las franquicias: que cada partida de la sala exista en
// el sitio y se pueda jugar con sus filtros (docs/versus/03-fase-1-base.md, paso 1.1).

/** Lo que hace falta para validar: las franquicias visibles (las de data/mode.json) y sus datos ya cargados. */
export interface SiteCatalog {
  readonly franchises: readonly FranchiseConfig[];
  readonly data: Readonly<Record<string, FranchiseData | undefined>>;
}

/** Los interruptores que existen (los de `ModeGame`). */
const TOGGLES = ['filler', 'manga'] as const;

/** Las variantes que acepta un modo: la de siempre (sin variante) y las que arma su motor. */
function variantsOf(mode: ModeConfig): readonly string[] {
  if (mode.engine === 'higher-lower' && mode.higherLower && mode.higherLower.metrics.length > 1) {
    return mode.higherLower.metrics.map((metric) => `m-${metric.key}`);
  }
  if (mode.engine === 'timeline' && mode.timeline?.levels) {
    return mode.timeline.levels.slice(1).map((_, index) => `d${index + 2}`);
  }
  // Estadísticas: nivel (0 a 2) y formas regionales y megas; la de siempre (nivel 1, sin formas) va sin variante.
  if (mode.engine === 'stat-builder' && mode.statBuilder) {
    return mode.statBuilder.targets.flatMap((_, level) => ['0', '1'].flatMap((r) => ['0', '1'].map((m) => `d${level}-r${r}-m${m}`))).filter((id) => id !== 'd1-r0-m0');
  }
  // Casillas: las tres dificultades.
  if (mode.engine === 'category-board') return ['d1', 'd2', 'd3'];
  return [];
}

/** Los problemas de una partida para el sitio; vacío si se puede jugar. */
export function partidaErrors(partida: Partida, catalog: SiteCatalog): string[] {
  const franchise = catalog.franchises.find((candidate) => candidate.slug === partida.franchise);
  if (!franchise) return [`la franquicia ${partida.franchise} no está activa`];
  const mode = franchise.modes.find((candidate) => candidate.slug === partida.mode);
  if (!mode || !isPlayable(franchise, mode)) return [`el modo ${partida.franchise}/${partida.mode} no está activo`];
  const errors: string[] = [];
  if (mode.engine !== partida.engine) errors.push(`el motor de ${partida.mode} es ${mode.engine}`);
  if (partida.variant !== undefined && !variantsOf(mode).includes(partida.variant)) errors.push(`la variante ${partida.variant} no existe`);
  const unknown = partida.series.filter((id) => !franchise.series.includes(id));
  if (unknown.length > 0) errors.push(`series que no son de ${franchise.slug}: ${unknown.join(', ')}`);
  for (const id of Object.keys(partida.toggles ?? {})) {
    if (!(TOGGLES as readonly string[]).includes(id) || (id === 'manga' && franchise.hideMangaToggle)) errors.push(`el interruptor ${id} no existe`);
  }
  const data = catalog.data[franchise.slug];
  if (!data) return [...errors, `faltan los datos de ${franchise.slug}`];
  if (errors.length > 0) return errors;
  // Apagar un interruptor deja afuera lo marcado; el manga queda siempre afuera si la franquicia no lo ofrece.
  const flagged = withoutFlagged(data, {
    skipFiller: partida.toggles?.filler === false,
    skipMangaOnly: franchise.hideMangaToggle === true || partida.toggles?.manga === false,
  });
  const size = modePoolSize(mode, flagged, partida.series);
  if (size === null || !hasMinimumPool(size, minimumPoolOf(mode))) errors.push(`${partida.franchise}/${partida.mode} no llega al mínimo con esos filtros`);
  return errors;
}

/** Si todas las partidas de la sala existen, están activas y alcanzan el mínimo con sus filtros. */
export function isValidForSite(config: VersusConfig, catalog: SiteCatalog): boolean {
  return config.partidas.every((partida) => partidaErrors(partida, catalog).length === 0);
}
