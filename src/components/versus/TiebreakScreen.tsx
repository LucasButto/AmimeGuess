'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { es } from '@/i18n/es';
import type { Partida } from '@/versus/config';
import type { Snapshot, SpinView, TiebreakView } from '@/versus/protocol';
import { AddMatchSheet } from './AddMatchSheet';
import { describePartida } from './describe';
import { namesOf } from './names';
import type { RoomConnection } from './useVersusRoom';
import styles from './TiebreakScreen.module.scss';

const copy = es.versus.tiebreak;

type Vote = NonNullable<TiebreakView['myVote']>;

/** Cuánto dura la ruleta en pantalla (la misma que usa el servidor entre la votación y la partida). */
const SPIN_SECONDS = 4;

/** El nombre corto de una opción: "Pokémon Clásico" (con la variante, si tiene). */
function optionName(partida: Pick<Partida, 'franchise' | 'mode' | 'variant' | 'series' | 'toggles'>): string {
  const description = describePartida(partida);
  return description.variant ? `${description.full} · ${description.variant}` : description.full;
}

/** El modo al que apunta una opción: uno de los jugados o el propuesto. */
function partidaOfVote(snapshot: Snapshot, option: Vote): Partida | undefined {
  if ('other' in option) return option.other;
  return snapshot.tiebreak?.played.find((entry) => entry.index === option.played)?.partida;
}

/** Los segundos que faltan hasta `endsAt` con la hora del servidor (se repinta cada 250 ms). */
function useSecondsLeft(endsAt: number | undefined, serverNow: () => number): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (endsAt === undefined) return;
    const tick = () => setNow(serverNow());
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [endsAt, serverNow]);
  return endsAt === undefined || now === null ? null : Math.max(0, Math.ceil((endsAt - now) / 1000));
}

/** La votación (solo la ven los empatados con botones) y la ruleta. */
export function TiebreakScreen({ snapshot, room }: { snapshot: Snapshot; room: RoomConnection }) {
  if (snapshot.phase === 'tiebreakSpin' && snapshot.spin) return <Spin snapshot={snapshot} spin={snapshot.spin} />;
  if (snapshot.tiebreak) return <Voting snapshot={snapshot} tiebreak={snapshot.tiebreak} room={room} />;
  return null;
}

function Voting({ snapshot, tiebreak, room }: { snapshot: Snapshot; tiebreak: TiebreakView; room: RoomConnection }) {
  const me = snapshot.you.playerId;
  const tied = me !== undefined && tiebreak.players.includes(me);
  const [mine, setMine] = useState<Vote | undefined>(tiebreak.myVote);
  const [adding, setAdding] = useState(false);
  const counter = useRef(0);
  const seconds = useSecondsLeft(tiebreak.votingEndsAt, room.serverNow);
  const open = room.status === 'open';

  function vote(option: Vote) {
    if (!open) return;
    room.send({ type: 'vote', option });
    setMine(option);
  }

  const chosen = mine ? partidaOfVote(snapshot, mine) : undefined;
  const timeAttack = snapshot.config.modality === 'timeAttack';

  return (
    <section className={styles.root} aria-labelledby="vs-tiebreak" data-tiebreak="vote">
      <header className={styles.header}>
        <h2 className={styles.title} id="vs-tiebreak">{copy.title}</h2>
        {tiebreak.round > 1 && <span className={styles.round}>{copy.round(tiebreak.round)}</span>}
      </header>
      <p className={styles.lead}>{copy.tied(namesOf(snapshot, tiebreak.players))}</p>
      <p className={styles.timer} role="timer">
        <span>{copy.timeLeft}</span> <strong data-tiebreak-seconds>{seconds === null ? '—' : copy.seconds(seconds)}</strong>
      </p>

      {tied ? (
        <>
          <p className={styles.lead}>{copy.choose}</p>
          <section className={styles.group} aria-label={copy.played}>
            <h3 className={styles.groupTitle}>{copy.played}</h3>
            <ul className={styles.cards}>
              {tiebreak.played.map((entry) => {
                const description = describePartida(entry.partida);
                const selected = mine !== undefined && 'played' in mine && mine.played === entry.index;
                return (
                  <li key={entry.index}>
                    <button type="button" className={styles.card} aria-pressed={selected} disabled={!open} onClick={() => vote({ played: entry.index })}>
                      <strong>{description.full}</strong>
                      {description.variant && <span>{description.variant}</span>}
                      <span className={styles.filters}>{description.filters}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
          <section className={styles.group} aria-label={copy.other}>
            <h3 className={styles.groupTitle}>{copy.other}</h3>
            <button type="button" className={styles.card} aria-pressed={mine !== undefined && 'other' in mine} disabled={!open} onClick={() => setAdding(true)}>
              <strong>{mine && 'other' in mine && chosen ? optionName(chosen) : copy.otherButton}</strong>
            </button>
          </section>
          <p className={styles.status} role="status">
            {mine ? copy.voteSent(tiebreak.voted, tiebreak.players.length) : copy.voted(tiebreak.voted, tiebreak.players.length)}
            {mine && chosen && <span className={styles.mine}> {copy.otherPicked(optionName(chosen))}</span>}
          </p>
          <AddMatchSheet
            open={adding}
            onClose={() => setAdding(false)}
            remaining={1}
            single={{ title: copy.otherTitle, add: copy.otherAdd }}
            nextId={() => `t${++counter.current}`}
            onAdd={(block) => {
              // El voto es una partida (sin tiempo propio fuera de Contrarreloj: el servidor usa el de su tipo de modo).
              const { timeLimitMs, ...rest } = block.partida;
              vote({ other: timeAttack ? { ...rest, timeLimitMs } : rest });
              setAdding(false);
            }}
          />
        </>
      ) : (
        <p className={styles.status} role="status">{copy.watching} {copy.voted(tiebreak.voted, tiebreak.players.length)}</p>
      )}
    </section>
  );
}

/** Las porciones de la ruleta: una por opción votada, proporcional a sus votos. */
interface Slice {
  readonly name: string;
  readonly percent: number;
  readonly start: number;
  readonly size: number;
  readonly color: string;
}

function slicesOf(snapshot: Snapshot, spin: SpinView): Slice[] {
  const total = spin.options.reduce((sum, option) => sum + option.votes, 0) || 1;
  let cursor = 0;
  return spin.options.map((entry, index) => {
    const partida = partidaOfVote(snapshot, entry.option);
    const size = (entry.votes / total) * 360;
    const slice: Slice = {
      name: partida ? optionName(partida) : '?',
      percent: Math.round((entry.votes / total) * 100),
      start: cursor,
      size,
      color: `hsl(${(index * 137 + 20) % 360} 62% 52%)`,
    };
    cursor += size;
    return slice;
  });
}

function Spin({ snapshot, spin }: { snapshot: Snapshot; spin: SpinView }) {
  const slices = slicesOf(snapshot, spin);
  const winner = slices[spin.winner] ?? slices[0];
  const single = slices.length <= 1;
  // El puntero está arriba: para dejar el centro de la porción ganadora ahí, la rueda gira lo que falta hasta 360° (más vueltas).
  const center = winner ? winner.start + winner.size / 2 : 0;
  const finalTurn = (360 - center) % 360;
  const turn = 360 * 4 + finalTurn;
  const gradient = slices.map((slice) => `${slice.color} ${slice.start}deg ${slice.start + slice.size}deg`).join(', ');

  return (
    <section className={styles.root} aria-labelledby="vs-spin" data-tiebreak="spin">
      <h2 className={styles.title} id="vs-spin">{single ? copy.title : copy.spinTitle}</h2>
      {single ? (
        <p className={styles.chosen} role="status">{copy.spinSame(winner?.name ?? '')}</p>
      ) : (
        <>
          <div className={styles.wheelBox}>
            <div className={styles.pointer} aria-hidden="true" />
            <div
              className={styles.wheel}
              role="img"
              aria-label={copy.wheel}
              style={{ background: `conic-gradient(${gradient})`, '--turn': `${turn}deg`, '--final': `${finalTurn}deg`, '--spin-seconds': `${SPIN_SECONDS}s` } as CSSProperties}
            />
          </div>
          <ul className={styles.legend} role="status">
            {slices.map((slice, index) => (
              <li key={`${slice.name}:${index}`} className={styles.legendItem} data-winner={index === spin.winner || undefined}>
                <span className={styles.swatch} style={{ background: slice.color }} aria-hidden="true" />
                <span>{copy.slice(slice.name, slice.percent)}</span>
              </li>
            ))}
          </ul>
          <p className={styles.chosen} role="status" data-spin-result>{copy.spinChosen(winner?.name ?? '')}</p>
        </>
      )}
    </section>
  );
}

/** Mientras juegan los empatados, los demás miran: quiénes juegan y cómo van (la tabla en vivo la dibuja `LiveBoard`). */
export function TiebreakPlayingNote({ snapshot }: { snapshot: Snapshot }) {
  const me = snapshot.you.playerId;
  const tied = snapshot.tiebreak?.players ?? [];
  const playing = me !== undefined && tied.includes(me);
  return <p className={styles.lead}>{playing ? copy.playingYou : copy.playingTied(namesOf(snapshot, tied))}</p>;
}

