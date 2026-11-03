import { allFranchises, franchises } from '@/franchises';
import { loadFranchiseData } from '@/franchises/data';
import { homeChannels } from '@/franchises/visibility';
import { modeStatus } from './[franchise]/[mode]/playable';

export interface PlayableFranchise {
  readonly slug: string;
  readonly name: string;
  /** Los modos que se pueden jugar, en orden (los ocultos por falta de contenido no están). */
  readonly modes: ReadonlyArray<{ readonly slug: string; readonly name: string }>;
}

/** Las franquicias visibles con sus modos jugables: de ahí salen el inicio, los retos de hoy y las estadísticas. Se calcula al generar la página. */
export async function loadPlayableFranchises(): Promise<readonly PlayableFranchise[]> {
  return Promise.all(
    franchises.map(async (franchise) => {
      const data = await loadFranchiseData(franchise.slug);
      const modes = franchise.modes.filter((mode) => modeStatus(franchise, mode, data) === 'playable');
      return { slug: franchise.slug, name: franchise.name, modes: modes.map((mode) => ({ slug: mode.slug, name: mode.name })) };
    }),
  );
}

export interface HomeEntry {
  readonly slug: string;
  readonly name: string;
  /** Los modos que se pueden jugar (vacío en una franquicia "Próximamente"). */
  readonly modes: ReadonlyArray<{ readonly slug: string; readonly name: string }>;
  readonly comingSoon: boolean;
}

/** Los canales del inicio, en orden: las franquicias jugables con sus modos y las "Próximamente" (sin modos, bloqueadas). */
export async function loadHomeChannels(): Promise<readonly HomeEntry[]> {
  const playable = await loadPlayableFranchises();
  return homeChannels(allFranchises).map((channel): HomeEntry => {
    const found = channel.comingSoon ? undefined : playable.find((franchise) => franchise.slug === channel.slug);
    return { slug: channel.slug, name: channel.name, modes: found?.modes ?? [], comingSoon: channel.comingSoon };
  });
}
