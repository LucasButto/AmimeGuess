import { es } from '@/i18n/es';
import type { TodayProgress } from '@/components/useSolvedToday';

export interface Channel {
  slug: string;
  name: string;
  /** Los modos que se pueden jugar (los ocultos por falta de contenido no cuentan). */
  modes: readonly string[];
  /** El nombre de cada modo, por slug (para "Seguí jugando"). */
  modeNames: Readonly<Record<string, string>>;
  /** "Próximamente": el canal se ve, con estática, pero no se puede abrir. */
  comingSoon?: boolean;
}

/** El progreso de hoy de cada franquicia jugable; `null` mientras no se leyó el almacenamiento. */
export type Progress = ReadonlyMap<string, TodayProgress> | null;

/** El progreso de hoy de un canal, con el nombre accesible del enlace; `solved` es `null` mientras no se leyó el almacenamiento. */
export function channelProgress(channel: Channel, progress: Progress) {
  const today = progress?.get(channel.slug) ?? null;
  const solved = today?.solved ?? null;
  const count = solved === null ? 0 : solved.size;
  const done = solved !== null && channel.modes.length > 0 && count === channel.modes.length;
  const label = solved === null ? es.home.cardLoading(channel.name) : es.home.cardLabel(channel.name, count, channel.modes.length);
  return { solved, count, done, label };
}

/**
 * El próximo reto pendiente: se busca desde el canal `from` (el que se ve) y se da la vuelta, sin contar los canales
 * "Próximamente". `'done'` si ya no queda ninguno, `null` mientras no se leyó el progreso.
 */
export function nextPending(channels: readonly Channel[], progress: Progress, from: number): { channel: Channel; mode: string } | 'done' | null {
  if (progress === null) return null;
  for (let step = 0; step < channels.length; step++) {
    const channel = channels[(from + step) % channels.length];
    if (channel.comingSoon) continue;
    const solved = progress.get(channel.slug)?.solved;
    const mode = channel.modes.find((slug) => !solved?.has(slug));
    if (mode !== undefined) return { channel, mode };
  }
  return 'done';
}
