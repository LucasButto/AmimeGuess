import type { FinishReport } from '@/components/game-shell/types';
import { MAX_MESSAGE_BYTES, type ClientMessage, type ErrorCode, type PlayerView, type ProgressView, type ServerMessage, type Snapshot } from '@/versus/protocol';
import { es } from '@/i18n/es';

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
    case 'progress': {
      const next: Snapshot = { ...current, progress: replaceProgress(current.progress, message.progress) };
      // El progreso propio dice en qué partida va (0: ya terminó todas).
      if (message.progress.playerId === current.you.playerId) {
        const own = message.progress;
        if (own.index === 0) delete next.mine;
        else if (current.mine?.index !== own.index) next.mine = { index: own.index, status: own.status };
        else next.mine = { ...current.mine, status: own.status };
      }
      return next;
    }
    case 'results':
      return { ...current, phase: 'finished', results: message.results };
    case 'tiebreak':
      return { ...current, phase: 'tiebreakVote', tiebreak: message.tiebreak };
    case 'spin':
      return { ...current, phase: 'tiebreakSpin', spin: message.spin };
    case 'tiebreakStart':
      return { ...current, phase: 'tiebreakPlaying', tiebreakGames: [...current.tiebreakGames.filter((game) => game.index !== message.index), { index: message.index, partida: message.partida }] };
    case 'rematch':
      return { ...current, rematch: message.code };
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

/** Una línea de grilla entra en 24 unidades (lo que acepta el protocolo). */
function fitLine(line: string): string {
  let out = '';
  for (const char of line) {
    if (out.length + char.length > 24) break;
    out += char;
  }
  return out;
}

/**
 * El `finish` que se manda al servidor con lo que reporta el juego: la grilla se recorta a las últimas líneas (y se achica
 * hasta entrar en los 2 KB del protocolo) y los textos de la respuesta a su largo máximo.
 */
export function buildFinish(index: number, report: FinishReport): Extract<ClientMessage, { type: 'finish' }> {
  let grid = report.grid.slice(-20).map(fitLine);
  const build = (lines: string[]): Extract<ClientMessage, { type: 'finish' }> => ({
    type: 'finish',
    index,
    won: report.won,
    attempts: Math.min(report.attempts, 100_000),
    ...(report.score === undefined ? {} : { score: Math.min(report.score, 100_000) }),
    ...(report.scores === undefined ? {} : { scores: report.scores.slice(-100).map((value) => Math.min(Math.max(0, Math.round(value)), 100_000)) }),
    grid: lines,
    answer: {
      label: report.answer.label.slice(0, 200),
      ...(report.answer.detail === undefined ? {} : { detail: report.answer.detail.slice(0, 100) }),
      ...(report.answer.imageStem === undefined ? {} : { imageStem: report.answer.imageStem.slice(0, 120) }),
    },
  });
  const size = (message: ClientMessage) => new TextEncoder().encode(JSON.stringify(message)).byteLength;
  while (grid.length > 0 && size(build(grid)) > MAX_MESSAGE_BYTES - 64) grid = grid.slice(1);
  return build(grid);
}

/**
 * El aviso corto de algo que pasó con otro jugador ("Beto terminó la partida 1", "Dani abandonó"), o `null`. El servidor no dice
 * cómo terminó cada una (eso es secreto hasta el final): solo que terminó.
 */
export function noticeFor(previous: ProgressView | undefined, next: ProgressView, players: readonly PlayerView[], me: string | undefined): string | null {
  if (next.playerId === me) return null;
  const name = players.find((player) => player.id === next.playerId)?.name;
  if (!name) return null;
  if (next.status === 'abandoned' && previous?.status !== 'abandoned') return es.versus.notices.abandoned(name);
  if (previous !== undefined && next.done > previous.done) return es.versus.notices.finished(name, next.done);
  return null;
}
