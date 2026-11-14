'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { es } from '@/i18n/es';
import { isRoomCode } from '@/versus/code';
import { LIMITS, groupRepeats, isValidName } from '@/versus/config';
import type { PlayerView, Snapshot } from '@/versus/protocol';
import { lookupRoom, type RoomLookup } from './api';
import { ArcadeButton } from './arcade/ArcadeButton';
import { ArcadeIcon } from './arcade/ArcadeIcon';
import { PlayerAvatar, avatarColor } from './arcade/PlayerAvatar';
import { describePartida, optionLines } from './describe';
import { formatClock } from './format';
import { countdownNumber, gameHref, type Notice } from './roomState';
import { readCredentials, readName, writeName, type Credentials } from './storage';
import { ResultsScreen } from './ResultsScreen';
import { useRoomHandle } from './store';
import { TiebreakPlayingNote, TiebreakScreen } from './TiebreakScreen';
import type { RoomConnection } from './useVersusRoom';
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
  // La conexión la tiene el proveedor del versus (en el layout): hay un solo WebSocket por sala mientras se navega.
  const handle = useRoomHandle(code);
  const room = handle?.connection ?? null;
  const [credentials] = useState<Credentials | null>(() => readCredentials(code));
  const [lookup, setLookup] = useState<RoomLookup | null>(null);
  const [joined, setJoined] = useState(false);
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
  useEffect(() => {
    if (watchOnly && handle) handle.spectate();
  }, [watchOnly, handle]);
  const snapshot = room?.snapshot ?? null;
  const status = room?.status ?? 'connecting';

  const notice: Notice | null = room?.notice ?? (watchOnly && lookup?.kind === 'exists' ? (lookup.phase !== 'lobby' ? 'started' : 'full') : null);

  // Al empezar la partida (o al recargar en medio de una), a la partida que le toca. Quien ya terminó todas espera acá.
  const navigated = useRef(false);
  useEffect(() => {
    if (!snapshot || snapshot.you.spectator || navigated.current) return;
    if (snapshot.phase !== 'playing' && snapshot.phase !== 'tiebreakPlaying') return;
    const own = snapshot.progress.find((item) => item.playerId === snapshot.you.playerId);
    if (own && own.index === 0) return;
    const href = gameHref(snapshot, own?.index || snapshot.mine?.index || 1);
    if (!href) return;
    navigated.current = true;
    router.push(href);
  }, [snapshot, router]);

  // La cuenta regresiva: 3, 2, 1 con la hora del servidor corregida.
  const [now, setNow] = useState(0);
  const counting = snapshot?.phase === 'countdown' && snapshot.startsAt !== undefined;
  const serverNow = room?.serverNow;
  useEffect(() => {
    if (!counting || !serverNow) return;
    const tick = () => setNow(serverNow());
    tick();
    const timer = window.setInterval(tick, 100);
    return () => window.clearInterval(timer);
  }, [counting, serverNow]);

  if (lookup?.kind === 'missing') {
    return <p className={styles.message} role="alert">{copy.notFound} <Link className={styles.link} href="/versus">{copy.backToCreate}</Link></p>;
  }
  if (!credentials && !joined && !watchOnly) {
    return (
      <JoinForm
        code={code}
        value={typed}
        onChange={setTyped}
        loading={lookup === null || handle === null}
        unavailable={lookup?.kind === 'unavailable'}
        onSubmit={(name) => {
          writeName(name);
          handle?.join(name);
          setJoined(true);
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
    room?.leave();
    router.push('/versus');
  }

  return (
    <div className={styles.root} data-room-screen>
      {notice && <p className={styles.notice} role="status" data-notice={notice}>{NOTICES[notice]}</p>}
      {status === 'reconnecting' && <p className={styles.notice} role="status">{copy.reconnecting}</p>}
      {status === 'unavailable' && (
        <div className={styles.notice} role="alert">
          <p>{copy.unavailable}</p>
          <ArcadeButton tone="blue" onClick={() => room?.retry()}>{copy.retry}</ArcadeButton>
        </div>
      )}

      <section className={styles.codeBox} aria-labelledby="vs-code">
        <div className={styles.stageBar}>
          <span className={styles.stageName}>{copy.stage}</span>
          {snapshot && <span className={styles.stageCount}><ArcadeIcon name="players" size="sm" /> {snapshot.players.length} / {LIMITS.players.max}</span>}
        </div>
        <p className={styles.codeLabel} id="vs-code">{copy.codeLabel}</p>
        <p className={styles.code} data-room-code aria-labelledby="vs-code">{code}</p>
        <div className={styles.codeActions}>
          <ArcadeButton tone="blue" icon="share" onClick={() => void share()}>{typeof navigator !== 'undefined' && typeof navigator.share === 'function' ? copy.share : copy.copy}</ArcadeButton>
          <span className={styles.copied} role="status">{copied ? copy.copied : ''}</span>
        </div>
      </section>

      {snapshot && room ? (
        snapshot.phase === 'lobby' || snapshot.phase === 'countdown' ? (
          <div className={styles.columns}>
            <Summary snapshot={snapshot} />
            <Players snapshot={snapshot} room={room} onLeave={leave} />
          </div>
        ) : snapshot.phase === 'tiebreakVote' || snapshot.phase === 'tiebreakSpin' ? (
          <TiebreakScreen snapshot={snapshot} room={room} />
        ) : snapshot.phase === 'finished' && snapshot.results ? (
          <ResultsScreen snapshot={snapshot} results={snapshot.results} room={room} onLeave={leave} />
        ) : (
          <LiveBoard snapshot={snapshot} onLeave={leave} />
        )
      ) : (
        status !== 'unavailable' && <p className={styles.message} role="status">{copy.connecting}</p>
      )}

      {counting && snapshot?.startsAt !== undefined && <CountdownOverlay value={countdownNumber(snapshot.startsAt, now)} snapshot={snapshot} />}
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
      <ArcadeButton type="submit" disabled={!valid || loading}>{copy.join}</ArcadeButton>
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

function Players({ snapshot, room, onLeave }: { snapshot: Snapshot; room: RoomConnection; onLeave: () => void }) {
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
        {snapshot.players.map((player, order) => {
          const state = statusOf(player);
          const self = player.id === me;
          return (
            <li key={player.id} className={styles.player} data-self={self || undefined} data-tone={state.tone} style={{ '--c': avatarColor(player.name) } as CSSProperties}>
              <span className={styles.seat}>{copy.seat(order + 1)}{player.id === snapshot.hostId ? ` · ${copy.creator}` : ''}</span>
              <PlayerAvatar name={player.name} size="lg" />
              <span className={styles.playerName}>
                <strong>{player.name}</strong>
              </span>
              <span className={styles.state} data-tone={state.tone}>{state.label}{state.tone === 'ready' && <ArcadeIcon name="check" size="sm" />}</span>
              {isHost && lobby && !self && (
                <button type="button" className={styles.kick} disabled={!open} aria-label={copy.kick(player.name)} onClick={() => room.send({ type: 'kick', playerId: player.id })}>
                  <ArcadeIcon name="close" size="sm" />
                </button>
              )}
            </li>
          );
        })}
        {lobby && snapshot.players.length < LIMITS.players.max && (
          <li className={styles.empty} aria-hidden="true">
            <ArcadeIcon name="add-player" size="lg" />
            <span>{copy.emptySlot}</span>
          </li>
        )}
      </ul>
      {lobby && snapshot.players.length < LIMITS.players.max && <p className={styles.waiting}>{copy.waiting(snapshot.players.length, LIMITS.players.max)}</p>}

      {mine && lobby && (
        <div className={styles.actions}>
          <ArcadeButton tone={mine.ready ? 'blue' : 'gold'} icon={mine.ready ? 'close' : 'check'} disabled={!open} aria-pressed={mine.ready} onClick={() => room.send({ type: 'ready', value: !mine.ready })}>
            {mine.ready ? copy.notReadyButton : copy.readyButton}
          </ArcadeButton>
          {isHost && (
            <>
              <ArcadeButton tone="gold" size="lg" disabled={!open || !canStart} onClick={() => room.send({ type: 'start' })}>» {copy.start} «</ArcadeButton>
              {!canStart && <p className={styles.hint}>{copy.startHint}</p>}
            </>
          )}
        </div>
      )}
      {snapshot.you.spectator && <p className={styles.hint}>{copy.spectator}</p>}
      <div className={styles.leaveRow}>
        <ArcadeButton tone="blue" icon="arrow-left" onClick={onLeave}>{copy.leave}</ArcadeButton>
      </div>
    </section>
  );
}

/** La cuenta regresiva a pantalla completa: 3, 2, 1 (con movimiento reducido, solo los números). */
function CountdownOverlay({ value, snapshot }: { value: number; snapshot: Snapshot }) {
  // El splash: la primera partida y los jugadores enfrentados ("VS"), con el número abajo.
  const first = snapshot.config.partidas[0];
  const me = snapshot.you.playerId;
  const names = snapshot.players.filter((player) => !player.abandoned);
  const mineFirst = names.find((player) => player.id === me) ?? names[0];
  const rivals = names.filter((player) => player !== mineFirst);
  return (
    <div className={styles.countdown} role="timer" aria-live="assertive" data-countdown>
      {first && <p className={styles.countdownLabel}>{es.versus.partidaOf(1, snapshot.config.partidas.length)} · {describePartida(first).full}</p>}
      {mineFirst && (
        <div className={styles.lineup} aria-hidden="true">
          <span className={styles.side} style={{ '--c': avatarColor(mineFirst.name) } as CSSProperties}>{mineFirst.name}</span>
          <span className={styles.vsRow}>
            <ArcadeIcon name="lightning-blue" size="xl" className={styles.spark} />
            <ArcadeIcon name="versus" size="hero" className={styles.vs} />
            <ArcadeIcon name="lightning-blue" size="xl" className={`${styles.spark} ${styles.flip}`} />
          </span>
          <span className={styles.side} style={{ '--c': avatarColor(rivals[0]?.name ?? '') } as CSSProperties}>
            {rivals.length > 2 ? `${rivals[0]?.name ?? ''} +${rivals.length - 1}` : rivals.map((player) => player.name).join(' · ')}
          </span>
        </div>
      )}
      <p className={styles.countdownNumber} key={value}>{value > 0 ? value : copy.go}</p>
    </div>
  );
}

/** El texto de cómo va un jugador, sin intentos ni nombres de lo que probó. */
function liveLine(snapshot: Snapshot, player: PlayerView): { text: string; tone: 'ready' | 'waiting' | 'away' } {
  const total = snapshot.config.partidas.length;
  const view = snapshot.progress.find((item) => item.playerId === player.id);
  if (player.abandoned) return { text: copy.abandoned, tone: 'away' };
  if (!player.connected) return { text: copy.disconnected, tone: 'away' };
  if (!view || view.index === 0) return { text: copy.doneAll, tone: 'ready' };
  const where = view.index > total ? es.versus.tiebreak.badge : es.versus.partidaOf(view.index, total);
  const extra = view.score === undefined ? es.versus.rivals.attempts(view.attempts) : es.versus.rivals.points(view.score);
  return { text: `${where} · ${extra}`, tone: 'waiting' };
}

/**
 * Mientras la sala juega: la tabla en vivo de todos (quien ya terminó espera acá a los demás y quien mira como espectador la
 * ve en lugar de los botones). Cuando la sala termina, la tabla final (el detalle completo llega en la sesión 32).
 */
function LiveBoard({ snapshot, onLeave }: { snapshot: Snapshot; onLeave: () => void }) {
  const tiebreak = snapshot.phase === 'tiebreakPlaying';
  const own = snapshot.progress.find((item) => item.playerId === snapshot.you.playerId);
  const waiting = !snapshot.you.spectator && own?.index === 0 && !tiebreak;
  // En el desempate solo importan los empatados.
  const tied = snapshot.tiebreak?.players;
  const players = tiebreak && tied ? snapshot.players.filter((player) => tied.includes(player.id)) : snapshot.players;
  return (
    <section className={styles.players} aria-labelledby="vs-live" data-live-board>
      <h2 className={styles.heading} id="vs-live">{tiebreak ? es.versus.tiebreak.playingTitle : waiting ? copy.waitingOthers : copy.live}</h2>
      {snapshot.you.spectator && <p className={styles.hint}>{copy.spectator}</p>}
      {tiebreak && <TiebreakPlayingNote snapshot={snapshot} />}
      <ul className={styles.list} role="status">
        {players.map((player, order) => {
          const line = liveLine(snapshot, player);
          return (
            <li key={player.id} className={styles.player} data-self={player.id === snapshot.you.playerId || undefined} data-tone={line.tone} style={{ '--c': avatarColor(player.name) } as CSSProperties}>
              <span className={styles.seat}>{copy.seat(order + 1)}{player.id === snapshot.hostId ? ` · ${copy.creator}` : ''}</span>
              <PlayerAvatar name={player.name} size="lg" />
              <span className={styles.playerName}>
                {player.id === snapshot.hostId && <ArcadeIcon name="crown-gold" size="md" label={copy.host} />}
                <strong>{player.name}</strong>
              </span>
              <span className={styles.state} data-tone={line.tone}>{line.text}</span>
            </li>
          );
        })}
      </ul>
      <div className={styles.leaveRow}>
        <ArcadeButton tone="blue" icon="arrow-left" onClick={onLeave}>{copy.leave}</ArcadeButton>
      </div>
    </section>
  );
}
