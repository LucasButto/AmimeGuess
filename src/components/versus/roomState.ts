import type { ErrorCode, ProgressView, ServerMessage, Snapshot } from '@/versus/protocol';

// El estado de la sala que ve el cliente: el último `snapshot` del servidor con los cambios que llegan después aplicados.
// Pura (sin React): la usa el hook de la sala y se prueba sola.

/** Aplica un mensaje del servidor al estado de la sala. Lo que todavía no se muestra (progreso, desempate) no lo cambia. */
export function applyMessage(current: Snapshot | null, message: ServerMessage): Snapshot | null {
  if (message.type === 'snapshot') return message;
  if (!current) return current;
  switch (message.type) {
    case 'players':
      return { ...current, players: message.players, hostId: message.hostId };
    case 'countdown':
      return { ...current, phase: 'countdown', startsAt: message.startsAt, ...(message.seed === undefined ? {} : { seed: message.seed }) };
    case 'lobby': {
      const next: Snapshot = { ...current, phase: 'lobby' };
      delete next.startsAt;
      return next;
    }
    case 'partidaStart':
      // La partida empezó para este jugador: la sala pasa a `playing` (la primera vez, al terminar la cuenta regresiva).
      return {
        ...current,
        phase: current.phase === 'countdown' || current.phase === 'lobby' ? 'playing' : current.phase,
        mine: { index: message.index, status: 'playing', startedAt: message.at, ...(message.endsAt === undefined ? {} : { endsAt: message.endsAt }) },
      };
    case 'progress':
      return { ...current, progress: replaceProgress(current.progress, message.progress) };
    default:
      return current;
  }
}

function replaceProgress(list: readonly ProgressView[], next: ProgressView): ProgressView[] {
  return list.some((item) => item.playerId === next.playerId) ? list.map((item) => (item.playerId === next.playerId ? next : item)) : [...list, next];
}

/** Un aviso que la pantalla muestra y que no se arregla con reintentar. */
export type Notice = 'full' | 'started' | 'kicked' | 'closed' | 'mismatch';

/** Qué aviso corresponde a un error del servidor, si corresponde. */
export function noticeOf(code: ErrorCode): Notice | null {
  switch (code) {
    case 'room_full':
      return 'full';
    case 'already_started':
      return 'started';
    case 'kicked':
      return 'kicked';
    case 'room_closed':
      return 'closed';
    case 'protocol_mismatch':
      return 'mismatch';
    default:
      return null;
  }
}

/** La dirección de la partida `index` de la sala (las de desempate siguen la numeración: 11, 12…), o `null` si no existe. */
export function gameHref(snapshot: Pick<Snapshot, 'code' | 'config' | 'tiebreakGames'>, index: number): string | null {
  const partida = index <= snapshot.config.partidas.length ? snapshot.config.partidas[index - 1] : snapshot.tiebreakGames.find((game) => game.index === index)?.partida;
  return partida ? `/${partida.franchise}/${partida.mode}?v=${snapshot.code}&p=${index}` : null;
}

/** La cuenta regresiva: el número que se ve (3, 2, 1) o `0` si ya es la hora. `null` sin cuenta. */
export function countdownNumber(startsAt: number, serverNow: number): number {
  return Math.max(0, Math.ceil((startsAt - serverNow) / 1000));
}
