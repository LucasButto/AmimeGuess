'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/Button';
import { es } from '@/i18n/es';
import { isRoomCode } from '@/versus/code';
import { LIMITS, groupRepeats, isValidName } from '@/versus/config';
import type { PlayerView, Snapshot } from '@/versus/protocol';
import { lookupRoom, type RoomLookup } from './api';
import { describePartida, optionLines } from './describe';
import { formatClock } from './format';
import { countdownNumber, gameHref, type Notice } from './roomState';
import { readCredentials, readName, writeName, type Credentials } from './storage';
import { useVersusRoom } from './useVersusRoom';
import styles from './RoomScreen.module.scss';

const copy = es.versus.room;

const NOTICES: Record<Notice, string> = {
  full: copy.full,
  started: copy.started,
  kicked: copy.kicked,
  closed: copy.closed,
  mismatch: copy.updatePage,
};

const subscribeNothing = () => () => undefined;

/** El estado de una persona en la lista. */
function statusOf(player: PlayerView): { label: string; tone: 'ready' | 'waiting' | 'away' } {
  if (player.abandoned) return { label: copy.abandoned, tone: 'away' };
  if (!player.connected) return { label: copy.disconnected, tone: 'away' };
  return player.ready ? { label: copy.ready, tone: 'ready' } : { label: copy.notReady, tone: 'waiting' };
}

function Crown() {
  return (
    <svg className={styles.crown} viewBox="0 0 24 24" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
      <path d="M3 7l4 4 5-7 5 7 4-4-2 11H5z" fill="currentColor" />
    </svg>
  );
}

/** `/versus/sala?c=CÓDIGO`: la sala de espera. Conecta con la sala, muestra quiénes están y arranca la partida con la cuenta regresiva. */
export function RoomScreen() {
  const params = useSearchParams();
  // Lo guardado en el navegador (el token de la sala) no existe en el servidor: hasta hidratar, solo el aviso de conexión.
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const raw = params.get('c')?.trim().toUpperCase() ?? '';
  const code = isRoomCode(raw) ? raw : null;
  if (!mounted) return <p className={styles.message} role="status">{copy.connecting}</p>;
  if (!code) return <p className={styles.message} role="status">{copy.noCode} <Link className={styles.link} href="/versus">{copy.backToCreate}</Link></p>;
  return <Room key={code} code={code} />;
}

function Room({ code }: { code: string }) {
  const router = useRouter();
  const [credentials] = useState<Credentials | null>(() => readCredentials(code));
  const [lookup, setLookup] = useState<RoomLookup | null>(null);
  const [joinName, setJoinName] = useState<string | null>(null);
  const [typed, setTyped] = useState(() => readName());
  const [copied, setCopied] = useState(false);

  // Sin lugar guardado se mira la sala antes de pedir el apodo: si no existe, ya empezó o está llena, se avisa.
  useEffect(() => {
    if (credentials) return;
    let cancelled = false;
    void lookupRoom(code).then((result) => {
      if (!cancelled) setLookup(result);
    });
    return () => {
      cancelled = true;
    };
  }, [code, credentials]);

  const watchOnly = lookup?.kind === 'exists' && (lookup.phase !== 'lobby' || lookup.players >= LIMITS.players.max);
  const room = useVersusRoom({ code, credentials, name: joinName, spectate: watchOnly });
  const { snapshot, status } = room;

  const notice: Notice | null = room.notice ?? (watchOnly && lookup?.kind === 'exists' ? (lookup.phase !== 'lobby' ? 'started' : 'full') : null);

  // Al empezar la partida (o al recargar en medio de una), a la partida que le toca.
  const navigated = useRef(false);
  useEffect(() => {
    if (!snapshot || snapshot.you.spectator || navigated.current) return;
    if (snapshot.phase !== 'playing' && snapshot.phase !== 'tiebreakPlaying') return;
    const href = gameHref(snapshot, snapshot.mine?.index ?? 1);
    if (!href) return;
    navigated.current = true;
    router.push(href);
  }, [snapshot, router]);

  // La cuenta regresiva: 3, 2, 1 con la hora del servidor corregida.
  const [now, setNow] = useState(0);
  const counting = snapshot?.phase === 'countdown' && snapshot.startsAt !== undefined;
  const { serverNow } = room;
  useEffect(() => {
    if (!counting) return;
    const tick = () => setNow(serverNow());
    tick();
    const timer = window.setInterval(tick, 100);
    return () => window.clearInterval(timer);
  }, [counting, serverNow]);

  if (lookup?.kind === 'missing') {
    return <p className={styles.message} role="alert">{copy.notFound} <Link className={styles.link} href="/versus">{copy.backToCreate}</Link></p>;
  }
  if (!credentials && joinName === null && !watchOnly) {
    return (
      <JoinForm
        code={code}
        value={typed}
        onChange={setTyped}
        loading={lookup === null}
        unavailable={lookup?.kind === 'unavailable'}
        onSubmit={(name) => {
          writeName(name);
          setJoinName(name);
        }}
      />
    );
  }

  const link = typeof window === 'undefined' ? '' : `${window.location.origin}/versus/sala?c=${code}`;

  async function share() {
    const text = copy.shareText(code);
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: es.site.name, text, url: link });
        return;
      }
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // La persona cerró el menú de compartir: no es un error.
    }
  }

  function leave() {
    room.leave();
    router.push('/versus');
  }

  return (
    <div className={styles.root} data-room-screen>
      {notice && <p className={styles.notice} role="status" data-notice={notice}>{NOTICES[notice]}</p>}
      {status === 'reconnecting' && <p className={styles.notice} role="status">{copy.reconnecting}</p>}
      {status === 'unavailable' && (
        <div className={styles.notice} role="alert">
          <p>{copy.unavailable}</p>
          <Button variant="secondary" onClick={room.retry}>{copy.retry}</Button>
        </div>
      )}

      <section className={styles.codeBox} aria-labelledby="vs-code">
        <p className={styles.codeLabel} id="vs-code">{copy.codeLabel}</p>
        <p className={styles.code} data-room-code aria-labelledby="vs-code">{code}</p>
        <div className={styles.codeActions}>
          <Button variant="secondary" onClick={() => void share()}>{typeof navigator !== 'undefined' && typeof navigator.share === 'function' ? copy.share : copy.copy}</Button>
          <span className={styles.copied} role="status">{copied ? copy.copied : ''}</span>
        </div>
      </section>

      {snapshot ? (
        <div className={styles.columns}>
          <Summary snapshot={snapshot} />
          <Players snapshot={snapshot} room={room} onLeave={leave} />
        </div>
      ) : (
        status !== 'unavailable' && <p className={styles.message} role="status">{copy.connecting}</p>
      )}

      {counting && snapshot?.startsAt !== undefined && <CountdownOverlay value={countdownNumber(snapshot.startsAt, now || serverNow())} />}
    </div>
  );
}

function JoinForm({ code, value, onChange, loading, unavailable, onSubmit }: { code: string; value: string; onChange: (value: string) => void; loading: boolean; unavailable: boolean; onSubmit: (name: string) => void }) {
  const id = useId();
  const name = value.trim();
  const valid = isValidName(name);
  return (
    <form
      className={styles.join}
      onSubmit={(event) => {
        event.preventDefault();
        if (valid && !loading) onSubmit(name);
      }}
    >
      <h2 className={styles.heading}>{copy.joinTitle}</h2>
      <p className={styles.lead}>{copy.joinLead(code)}</p>
      <label className={styles.label} htmlFor={id}>{es.versus.create.name.label}</label>
      <input id={id} className={styles.input} type="text" value={value} maxLength={LIMITS.name.max} autoComplete="nickname" aria-invalid={value !== '' && !valid} onChange={(event) => onChange(event.target.value)} />
      <p className={styles.hint}>{value !== '' && !valid ? es.versus.create.name.invalid : es.versus.create.name.hint}</p>
      {unavailable && <p className={styles.notice} role="alert">{copy.unavailable}</p>}
      <Button type="submit" variant="primary" disabled={!valid || loading}>{copy.join}</Button>
    </form>
  );
}

/** La sala sin poder editarla: modalidad, partidas agrupadas con su ×N y su tiempo, y las opciones que valen. */
function Summary({ snapshot }: { snapshot: Snapshot }) {
  const { config } = snapshot;
  const groups = useMemo(() => groupRepeats(config.partidas), [config.partidas]);
  const lines = optionLines(config);
  const timed = config.modality === 'timeAttack';
  return (
    <section className={styles.summary} aria-labelledby="vs-summary">
      <h2 className={styles.heading} id="vs-summary">{copy.summary}</h2>
      <p className={styles.modality}>{copy.modalityLine(es.versus.modality[config.modality])} · {copy.partidaLine(config.partidas.length)}</p>
      <ol className={styles.groups}>
        {groups.map((group) => {
          const info = describePartida(group.partida);
          return (
            <li key={group.start} className={styles.group}>
              <p className={styles.groupTitle}>
                <strong>{info.franchise} · {info.mode}</strong>
                {group.count > 1 && <span className={styles.times}>{es.versus.create.partidas.repeats(group.count)}</span>}
              </p>
              <p className={styles.groupMeta}>
                {[info.variant, info.filters, timed && group.partida.timeLimitMs !== undefined ? copy.timeLimit(formatClock(group.partida.timeLimitMs)) : null].filter(Boolean).join(' · ')}
              </p>
            </li>
          );
        })}
      </ol>
      {lines.length > 0 && (
        <div className={styles.options}>
          <h3 className={styles.subheading}>{copy.options}</h3>
          <ul className={styles.optionList}>
            {lines.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}

function Players({ snapshot, room, onLeave }: { snapshot: Snapshot; room: ReturnType<typeof useVersusRoom>; onLeave: () => void }) {
  const me = snapshot.you.playerId;
  const isHost = me !== undefined && snapshot.hostId === me;
  const mine = snapshot.players.find((player) => player.id === me);
  const readyCount = snapshot.players.filter((player) => player.ready && !player.abandoned).length;
  const lobby = snapshot.phase === 'lobby';
  const canStart = isHost && lobby && readyCount >= 2;
  const open = room.status === 'open';
  return (
    <section className={styles.players} aria-labelledby="vs-players">
      <h2 className={styles.heading} id="vs-players">{copy.players}</h2>
      <ul className={styles.list}>
        {snapshot.players.map((player) => {
          const state = statusOf(player);
          const self = player.id === me;
          return (
            <li key={player.id} className={styles.player} data-self={self || undefined}>
              <span className={styles.playerName}>
                {player.id === snapshot.hostId && <Crown />}
                <strong>{player.name}</strong>
                {player.id === snapshot.hostId && <span className={styles.srOnly}> ({copy.host})</span>}
                {self && <span className={styles.you}>{copy.you}</span>}
              </span>
              <span className={styles.state} data-tone={state.tone}>{state.label}</span>
              {isHost && lobby && !self && (
                <button type="button" className={styles.kick} disabled={!open} aria-label={copy.kick(player.name)} onClick={() => room.send({ type: 'kick', playerId: player.id })}>
                  <span aria-hidden="true">✕</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {lobby && snapshot.players.length < LIMITS.players.max && <p className={styles.waiting}>{copy.waiting(snapshot.players.length, LIMITS.players.max)}</p>}

      {mine && lobby && (
        <div className={styles.actions}>
          <Button variant={mine.ready ? 'secondary' : 'primary'} disabled={!open} aria-pressed={mine.ready} onClick={() => room.send({ type: 'ready', value: !mine.ready })}>
            {mine.ready ? copy.notReadyButton : copy.readyButton}
          </Button>
          {isHost && (
            <>
              <Button variant="primary" disabled={!open || !canStart} onClick={() => room.send({ type: 'start' })}>{copy.start}</Button>
              {!canStart && <p className={styles.hint}>{copy.startHint}</p>}
            </>
          )}
        </div>
      )}
      {snapshot.you.spectator && <p className={styles.hint}>{copy.spectator}</p>}
      <div className={styles.leaveRow}>
        <Button variant="ghost" onClick={onLeave}>{copy.leave}</Button>
      </div>
    </section>
  );
}

/** La cuenta regresiva a pantalla completa: 3, 2, 1 (con movimiento reducido, solo los números). */
function CountdownOverlay({ value }: { value: number }) {
  return (
    <div className={styles.countdown} role="timer" aria-live="assertive" data-countdown>
      <p className={styles.countdownLabel}>{value > 0 ? copy.countdown : copy.starting}</p>
      <p className={styles.countdownNumber} key={value}>{value > 0 ? value : copy.go}</p>
    </div>
  );
}
