import type { Snapshot } from '@/versus/protocol';

/** Los apodos de unos jugadores, en una frase: "Ana", "Ana y Beto", "Ana, Beto y Caro". */
export function namesOf(snapshot: Pick<Snapshot, 'players'>, ids: readonly string[]): string {
  const names = ids.map((id) => snapshot.players.find((player) => player.id === id)?.name ?? '?');
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}
