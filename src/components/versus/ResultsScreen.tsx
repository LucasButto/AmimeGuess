'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ContentImage } from '@/components/ContentImage';
import { Button } from '@/components/ui/Button';
import { es } from '@/i18n/es';
import type { Results, Snapshot } from '@/versus/protocol';
import { versusDay } from '@/versus/seed';
import { describePartida } from './describe';
import { formatClock } from './format';
import { placesOf, pointsOf, repeatMarks, solvedCounts, tableLines } from './resultsView';
import { clearRoomGames, readCredentials, writeCredentials } from './storage';
import type { RoomConnection } from './useVersusRoom';
import styles from './ResultsScreen.module.scss';

const copy = es.versus.results;

/** El valor principal de una fila de la tabla final, según la modalidad. */
function valueOf(results: Results, row: Results['table'][number], solved: number, total: number): string {
  if (results.modality === 'timeAttack') return `${row.totalMs === undefined ? '—' : formatClock(row.totalMs)} · ${copy.solved(solved, total)}`;
  if (results.modality === 'race') return row.arrivalMs === undefined ? '—' : formatClock(row.arrivalMs);
  return row.halfPoints === undefined ? '—' : copy.score(row.halfPoints / 2);
}

function tableText(results: Results, solved: Record<string, number>, total: number): string {
  const rows = tableLines(results).map((line) => {
    const row = results.table.find((entry) => entry.playerId === line.playerId);
    return `${copy.place(line.place)} ${line.name} — ${row ? valueOf(results, row, solved[line.playerId] ?? 0, total) : ''}`;
  });
  return rows.join('\n');
}

export function ResultsScreen({ snapshot, results, room, onLeave }: { snapshot: Snapshot; results: Results; room: RoomConnection; onLeave: () => void }) {
  const router = useRouter();
  const names = new Map(results.players.map((player) => [player.id, player.name]));
  const total = snapshot.config.partidas.length;
  const solved = useMemo(() => solvedCounts(results), [results]);
  const lines = tableLines(results);
  const winners = lines.filter((line) => line.place === 1);
  const isHost = snapshot.you.playerId !== undefined && snapshot.you.playerId === snapshot.hostId;
  const [shared, setShared] = useState(false);
  const [rematching, setRematching] = useState(false);
  const tiebreakGame = results.partidas.filter((partida) => partida.tiebreak).at(-1);
  const marks = repeatMarks(results.partidas.filter((partida) => !partida.tiebreak).map((partida) => partida.partida));

  // Al ver los resultados se borran las partidas guardadas de la sala (solo esas).
  const seed = snapshot.seed;
  useEffect(() => {
    if (seed === undefined) return;
    clearRoomGames(results.partidas.map((partida) => versusDay(seed, partida.index)));
  }, [seed, results.partidas]);

  // La revancha: el servidor ya pasó a todos los conectados a la sala nueva con el mismo id y token.
  const rematch = snapshot.rematch;
  const code = snapshot.code;
  useEffect(() => {
    if (!rematch) return;
    const credentials = readCredentials(code);
    if (credentials) writeCredentials(rematch, credentials);
    router.push(`/versus/sala?c=${rematch}`);
  }, [rematch, code, router]);

  async function share() {
    const text = copy.shareText(es.versus.modality[results.modality], tableText(results, solved, total), `${window.location.origin}/versus/sala?c=${snapshot.code}`);
    try {
      if (typeof navigator.share === 'function') await navigator.share({ title: copy.shareTitle, text });
      else await navigator.clipboard.writeText(text);
      setShared(true);
    } catch {
      // Cancelar el menú de compartir no es un error.
    }
  }

  return (
    <section className={styles.root} aria-labelledby="vs-results" data-results>
      <header className={styles.winner}>
        <h2 className={styles.title} id="vs-results">
          {winners.length === 1 ? copy.winner(winners[0]!.name) : copy.winners(winners.map((line) => line.name).join(', '))}
        </h2>
        {results.tiebreakWon && tiebreakGame && <p className={styles.sub}>{copy.wonTiebreak(describePartida(tiebreakGame.partida).full)}</p>}
      </header>

      <ol className={styles.table} aria-label={copy.title}>
        {results.table.map((row) => (
          <li key={row.playerId} className={styles.row} data-self={row.playerId === snapshot.you.playerId || undefined} data-first={row.place === 1 || undefined}>
            <span className={styles.place}>{copy.place(row.place)}</span>
            <strong className={styles.name}>{names.get(row.playerId) ?? '?'}</strong>
            <span className={styles.value}>{valueOf(results, row, solved[row.playerId] ?? 0, total)}</span>
          </li>
        ))}
      </ol>
      {results.modality === 'fewestAttempts' && <p className={styles.rule}>{copy.rule(results.players.length)}</p>}

      <details className={styles.details}>
        <summary className={styles.summary}>{copy.detail}</summary>
        <ol className={styles.partidas}>
          {results.partidas.map((partida, order) => {
            const description = describePartida(partida.partida);
            const mark = partida.tiebreak ? null : marks[order];
            const places = placesOf(partida.ranking);
            const points = results.modality === 'fewestAttempts' ? pointsOf(partida.ranking, results.players.length) : null;
            const answer = partida.games.find((game) => game.answer)?.answer;
            const ordered = [...partida.games].sort((a, b) => (places[a.playerId] ?? 99) - (places[b.playerId] ?? 99));
            return (
              <li key={partida.index} className={styles.partida}>
                <h3 className={styles.partidaTitle}>
                  {partida.tiebreak ? `${copy.tiebreakGame} · ` : `${copy.partida(order + 1, total)} · `}
                  {description.full}
                  {description.variant && ` · ${description.variant}`}
                  {mark && ` ${copy.repeat(mark.n, mark.of)}`}
                </h3>
                {answer && (
                  <p className={styles.answer}>
                    {answer.imageStem && <ContentImage className={styles.image} stem={answer.imageStem} alt="" sizes="3rem" />}
                    <span>
                      <span className={styles.label}>{copy.answer}</span> <strong>{answer.label}</strong>
                      {answer.detail && <> – {answer.detail}</>}
                    </span>
                  </p>
                )}
                <ul className={styles.games}>
                  {ordered.map((game) => (
                    <li key={game.playerId} className={styles.game}>
                      <span className={styles.gameHead}>
                        <strong>{copy.place(places[game.playerId] ?? 0)} {names.get(game.playerId) ?? '?'}</strong>
                        <span className={styles.status}>{copy.status[game.status]}</span>
                        {game.status === 'timeUp' && partida.partida.timeLimitMs !== undefined ? (
                          <span>{copy.limit(formatClock(partida.partida.timeLimitMs))}</span>
                        ) : (
                          game.elapsedMs !== undefined && <span>{formatClock(game.elapsedMs)}</span>
                        )}
                        {game.score !== undefined ? <span>{copy.score(game.score)}</span> : game.attempts !== undefined && <span>{copy.attempts(game.attempts)}</span>}
                        {points && points[game.playerId] !== undefined && <span>+{points[game.playerId]!.toLocaleString('es-AR')}</span>}
                      </span>
                      {game.grid && game.grid.length > 0 && (
                        <code className={styles.grid}>
                          {game.grid.map((line, index) => (
                            <span key={`${index}:${line}`}>{line}</span>
                          ))}
                        </code>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      </details>

      <div className={styles.actions}>
        <Button variant="secondary" onClick={() => void share()}>{shared ? copy.shareDone : copy.share}</Button>
        {isHost ? (
          <Button
            variant="primary"
            disabled={rematching || room.status !== 'open'}
            onClick={() => {
              setRematching(true);
              room.send({ type: 'rematch' });
            }}
          >
            {rematching ? copy.rematching : copy.rematch}
          </Button>
        ) : (
          <p className={styles.hint}>{copy.host}</p>
        )}
        <Link className={styles.link} href="/versus">{copy.another}</Link>
        <Button variant="ghost" onClick={onLeave}>{copy.home}</Button>
      </div>
    </section>
  );
}
